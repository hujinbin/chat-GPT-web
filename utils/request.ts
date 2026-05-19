// 统一 API 基础地址（正式环境由 nginx 将 /api 代理到后端）
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

import axios, {
    AxiosHeaders,
    AxiosInstance,
    AxiosError,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';

const REQUEST_TIMEOUT = 15_000;

const service: AxiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: REQUEST_TIMEOUT,
});

service.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        config.headers = config.headers ?? new AxiosHeaders();

        if (!config.headers.has('Content-Type') && !(config.data instanceof FormData)) {
            config.headers.set('Content-Type', 'application/json');
        }

        return config;
    },
    (error: AxiosError) => {
        console.error('Request error:', error);
        return Promise.reject(error);
    }
);

service.interceptors.response.use(
    (response: AxiosResponse) => response.data,
    (error: AxiosError) => {
        console.error('Response error:', error);
        return Promise.reject(error);
    }
);

function request<T = unknown>(config: AxiosRequestConfig): Promise<T> {
    return service.request<T, T>(config);
}

const enhancedRequest = request as typeof request & AxiosInstance;
Object.assign(enhancedRequest, service);

export { service };
export default enhancedRequest;
