/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'www.google.com',
            },
            {
                protocol: 'https',
                hostname: 'upload.wikimedia.org',
            },
            {
                protocol: 'https',
                hostname: 'mailmeteor.com',
            },
            {
                protocol: 'https',
                hostname: 'pluspng.com',
            },
        ],
    },
};

export default nextConfig;
