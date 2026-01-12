


module.exports.authEdge = function authEdge(req, res, next) {
    //  console.log('тута')
    const tok = req.header('X-Edge-Token');
    if (!tok || tok !== 'dev-core') {
        return res.status(401).json({ error: 'unauthorized edge' });
    }
    next();
};