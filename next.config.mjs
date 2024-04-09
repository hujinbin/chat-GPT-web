/** @type {import('next').NextConfig} */
const nextConfig = {
    exportPathMap: async function (defaultPathMap) {
        return {
          '/': { page: '/' },
        }
    }
};

export default nextConfig;
