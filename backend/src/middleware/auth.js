import jwt from 'jsonwebtoken'

export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' })
    }

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET)
    req.userId = decodedToken.userId
    req.userRole = decodedToken.role
    next()
  } catch (error) {
    res.status(401).json({ message: 'Authentication failed' })
  }
}

export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ message: 'Access denied' })
    }
    next()
  }
}
