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

export async function streamChatCompletion(options: StreamChatOptions): Promise<{ content: string }> {
  const { provider, baseUrl, apiKey, model, messages, temperature = 0.8, onChunk, signal } = options;

  const bodyPayload = {
    provider: provider || (baseUrl ? 'custom-openai' : 'built-in-gemini'),
    baseUrl: baseUrl || '',
    apiKey: apiKey || '',
    model,
    messages,
    temperature,
    stream: true,
  };

  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(bodyPayload),
    signal,
  });

  if (!response.ok) {
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
  if (provider === 'built-in-gemini' || !baseUrl) {
    const res = await fetch('/api/ai/models');
    const data = await res.json();
    return data.data || [];
  }

  const queryParams = new URLSearchParams({
    provider,
    baseUrl,
    apiKey,
  });

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
}
