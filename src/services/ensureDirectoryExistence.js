import path from 'path'; // << QUAN TRỌNG!
import fs from 'fs/promises'; // Nếu bạn dùng fs.promises ở đây

export const ensureDirectoryExistence = async (filePath) => {
    const dirname = path.dirname(filePath);
    try {
        await fs.access(dirname);
    } catch (e) {
        if (e.code === 'ENOENT') {
            await fs.mkdir(dirname, { recursive: true });
        } else {
            throw e;
        }
    }
};
