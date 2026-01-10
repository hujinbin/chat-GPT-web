import axios, {
    AxiosInstance,
    AxiosError,
    AxiosRequestConfig,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_BASE ?? '/api';
const REQUEST_TIMEOUT = 15_000;

const service: AxiosInstance = axios.create({
    baseURL,
    timeout: REQUEST_TIMEOUT,
});

service.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        if (!config.headers) {
            config.headers = {};
        }

        if (!config.headers['Content-Type'] && !(config.data instanceof FormData)) {
            config.headers['Content-Type'] = 'application/json';
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
