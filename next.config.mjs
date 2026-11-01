import withAntdLess from 'next-plugin-antd-less';

const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",   // 👈 必须加这个
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
                        destination: 'http://localhost:8080/api/:path*',
                    },
                ];
            },
        }
        : {}),
};

export default withAntdLess(nextConfig);
