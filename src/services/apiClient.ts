export interface Message {
  role: 'system' | 'user' | 'assistant' | 'model';
  content: string;
}

export interface StreamChatOptions {
  provider?: string;
  baseUrl?: string;
  apiKey?: string;
  model: string;
  messages: Message[];
  temperature?: number;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

// Direct browser fetch to custom OpenAI-compatible endpoint (e.g. DeepSeek, SiliconFlow, OneAPI, OpenAI proxy)
async function directBrowserChatStream(options: StreamChatOptions): Promise<{ content: string }> {
  const { baseUrl, apiKey, model, messages, temperature = 0.8, onChunk, signal } = options;
  if (!baseUrl) {
    throw new Error('未配置 API 地址 (Base URL)。请在“基础与线路配置”页面配置您的 API 线路。');
  }

  const cleanUrl = baseUrl.replace(/\/+$/, '');
  const targetUrl = cleanUrl.endsWith('/chat/completions') ? cleanUrl : `${cleanUrl}/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role === 'model' ? 'assistant' : m.role,
        content: m.content,
      })),
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMessage = `API 错误 (${response.status})`;
    try {
      const errJson = JSON.parse(text);
      if (errJson.error?.message) errorMessage = errJson.error.message;
      else if (errJson.error) errorMessage = typeof errJson.error === 'string' ? errJson.error : JSON.stringify(errJson.error);
    } catch {
      if (text) errorMessage = text.slice(0, 300);
    }
    throw new Error(errorMessage);
  }

  if (!response.body) {
    throw new Error('未收到 API 流式数据响应');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;

      if (trimmed.startsWith('data: ')) {
        try {
          const rawJson = trimmed.slice(6);
          const json = JSON.parse(rawJson);

          if (json.error) {
            throw new Error(typeof json.error === 'string' ? json.error : json.error.message || '模型响应错误');
          }

          const deltaContent = json.choices?.[0]?.delta?.content;
          if (deltaContent) {
            fullContent += deltaContent;
            onChunk(deltaContent);
          }
        } catch (err: any) {
          if (err.message && !err.message.includes('JSON')) {
            throw err;
          }
        }
      }
    }
  }

  return { content: fullContent };
}

export async function streamChatCompletion(options: StreamChatOptions): Promise<{ content: string }> {
  const { provider, baseUrl, apiKey, model, messages, temperature = 0.8, onChunk, signal } = options;

  // If a custom Base URL is specified (e.g., DeepSeek / SiliconFlow / OneAPI / OpenAI proxy), prefer direct client-side fetch first for pure static deployment!
  if (baseUrl && apiKey) {
    try {
      return await directBrowserChatStream(options);
    } catch (directErr: any) {
      console.warn('Direct browser fetch failed, trying backend proxy fallback...', directErr);
      // If direct fetch fails due to CORS or network, fall back to backend proxy route if available
    }
  }

  const bodyPayload = {
    provider: provider || (baseUrl ? 'custom-openai' : 'built-in-gemini'),
    baseUrl: baseUrl || '',
    apiKey: apiKey || '',
    model,
    messages,
    temperature,
    stream: true,
  };

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
      signal,
    });

    if (!response.ok) {
      // If server route is 404 (e.g., GitHub Pages static hosting), throw clear guidance or try direct if possible
      if (response.status === 404 && baseUrl) {
        return await directBrowserChatStream(options);
      }
      const text = await response.text();
      let errorMessage = `请求失败 (${response.status})`;
      try {
        const errJson = JSON.parse(text);
        if (errJson.error) errorMessage = errJson.error;
      } catch {
        if (text) errorMessage = text.slice(0, 300);
      }
      throw new Error(errorMessage);
    }

    if (!response.body) {
      throw new Error('未收到服务器流式数据响应');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const rawJson = trimmed.slice(6);
            const json = JSON.parse(rawJson);

            if (json.error) {
              throw new Error(json.error);
            }

            const deltaContent = json.choices?.[0]?.delta?.content;
            if (deltaContent) {
              fullContent += deltaContent;
              onChunk(deltaContent);
            }
          } catch (err: any) {
            if (err.message && !err.message.includes('JSON')) {
              throw err;
            }
          }
        }
      }
    }

    return { content: fullContent };
  } catch (err: any) {
    if (baseUrl) {
      return await directBrowserChatStream(options);
    }
    throw err;
  }
}

export async function chatCompletion(options: Omit<StreamChatOptions, 'onChunk'>): Promise<{ content: string; model: string }> {
  let accumulated = '';
  const result = await streamChatCompletion({
    ...options,
    onChunk: (chunk) => {
      accumulated += chunk;
    },
  });
  return { content: result.content || accumulated, model: options.model };
}

export async function testAndFetchModels(
  baseUrl: string,
  apiKey: string,
  provider: string = 'custom-openai'
): Promise<Array<{ id: string; name?: string }>> {
  if (baseUrl && apiKey) {
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const response = await fetch(`${cleanUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          return data.data.map((m: any) => ({
            id: m.id,
            name: m.id,
          }));
        }
      }
    } catch (e) {
      console.warn('Direct fetch models failed, falling back to proxy endpoint...', e);
    }
  }

  if (provider === 'built-in-gemini' || !baseUrl) {
    try {
      const res = await fetch('/api/ai/models');
      if (res.ok) {
        const data = await res.json();
        return data.data || [];
      }
    } catch {
      return [
        { id: 'deepseek-chat', name: 'DeepSeek V3 / R1 (推荐)' },
        { id: 'gpt-4o', name: 'GPT-4o' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      ];
    }
  }

  const queryParams = new URLSearchParams({
    provider,
    baseUrl,
    apiKey,
  });

  try {
    const response = await fetch(`/api/ai/models?${queryParams.toString()}`);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`无法连接到 API 或 API 密钥无效: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error);
    }
    return data.data || [];
  } catch (err: any) {
    throw new Error(err.message || '获取模型列表失败');
  }
}

