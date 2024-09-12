import withAntdLess from 'next-plugin-antd-less';

/** @type {import('next').NextConfig} */
const nextConfig = {
    exportPathMap: async function (defaultPathMap) {
        return {
          '/': { page: '/' },
        }
    }
};

export default withAntdLess(nextConfig);
