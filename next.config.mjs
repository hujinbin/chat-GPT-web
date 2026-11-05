import withAntdLess from 'next-plugin-antd-less';

const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
    // 开发与生产分别使用缓存目录，避免构建时覆盖正在运行的开发服务。
    distDir: isDev ? '.next-dev' : '.next',
    images: {
        unoptimized: true // 👈 静态打包必须关闭图片优化
    },
    // 仅本地开发生效：把 /api 代理到本地后端，避免跨域；生产环境仍由 nginx 转发
    ...(isDev
        ? {
            async rewrites() {
                return [
                    {
                        source: '/api/:path*',
                        destination: 'http://127.0.0.1:8080/api/:path*',
                    },
                ];
            },
        }
        // 仅生产构建静态导出，开发模式保留实时路由和接口代理。
        : { output: 'export' }),
};

export default withAntdLess(nextConfig);
