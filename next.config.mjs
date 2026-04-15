import withAntdLess from 'next-plugin-antd-less';

/** @type {import('next').NextConfig} */
const nextConfig = {
    exportPathMap: async function (defaultPathMap) {
        return {
          '/': { page: '/' },
        }
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://localhost:8080/api/:path*',
            },
        ];
    },
};

export default withAntdLess(nextConfig);
