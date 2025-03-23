const verifyRole = (requiredRole) => {
    return (req, res, next) => {
        if (!req.body.role || req.body.role !== requiredRole) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You do not have permission.',
            });
        }
        next();
    };
};

export default verifyRole;
