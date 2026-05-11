import withAntdLess from 'next-plugin-antd-less';

/** @type {import('next').NextConfig} */
const nextConfig = {
    output: "export",   // 👈 必须加这个
    images: {
        unoptimized: true // 👈 静态打包必须关闭图片优化
    },
    // exportPathMap: async function (defaultPathMap) {
    //     return {
    //       '/': { page: '/' },
    //     }
    // },
    // async rewrites() {
    //     return [
    //         {
    //             source: '/api/:path*',
    //             destination: 'http://localhost:8080/api/:path*',
    //         },
    //     ];
    // },
};

export default withAntdLess(nextConfig);
