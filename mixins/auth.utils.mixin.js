const jwt = require("jsonwebtoken");
const jwtSecret = process.env.JWT_SECRET;

const getSessionCacheKey = (userId) => {
	return `users.sessions.${userId}`;
};

const getSessionParams = (user) => {
	return {
		id: user.id,
		username: user.username,
		email: user.email,
		isVerified: user.is_verified,
		fullName: user.full_name,
		countryCode: user.country_code,
		accountSource: user.account_source,
		userType: user.user_type,
	};
};

const getCookieParams = (user) => {
	return {
		id: user.id,
	};
};

// Token handlers
const verifyToken = (token, customSecret) => {
	try {
		return token ? jwt.verify(token, customSecret || jwtSecret) : null;
	} catch (e) {
		return null;
	}
};

const createToken = (tokenData, jwtOptions, customSecret) => {
	try {
		const defaultJwtOptions = {
			expiresIn: "60m",
		};
		const newToken = jwt.sign(tokenData, customSecret || jwtSecret, {
			...defaultJwtOptions,
			...jwtOptions,
		});
		return newToken;
	} catch (e) {
		return e;
	}
};

const userToAuthPayload = (user, jwtOptions, jwtSecret) => {
	const tokenData = getCookieParams(user);
	const token = createToken(tokenData, jwtOptions, jwtSecret);
	return token;
};

module.exports = {
	getSessionParams,
	getCookieParams,
	getSessionCacheKey,
	userToAuthPayload,
	verifyToken,
};
