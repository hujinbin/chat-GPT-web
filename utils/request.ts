import axios, { AxiosInstance, AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const host: string = "https://ai.leheavengame.com";
console.log(host)

const service: AxiosInstance = axios.create({
    baseURL: '/api',
    timeout: 5000
});

service.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // config.headers['Content-Type'] = 'application/json'
        return config;
    },
    (error: AxiosError) => {
        console.log(error);
        return Promise.reject();
    }
);

service.interceptors.response.use(
    (response: AxiosResponse) => {
        if (response.status === 200) {
            return response.data;
        } else {
            Promise.reject();
        }
    },
    (error: AxiosError) => {
        console.log(error)
        return Promise.reject(error);
    }
);

export default service;
