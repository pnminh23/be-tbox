export const formatString = (input) => {
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/\s+/g, ' ');
};
