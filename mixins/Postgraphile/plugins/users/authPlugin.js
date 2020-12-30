const { makeExtendSchemaPlugin, gql } = require("graphile-utils");
const argon2 = require("argon2");
const schema = process.env.ACCOUNTS_SCHEMA;
const {
	validatePassword,
	fetchUser,
	userToAuthPayload,
	validateUser,
} = require("../utils/auth");
const {
	getSessionParams,
	getSessionCacheKey,
	verifyToken,
} = require("../../../auth.utils.mixin");

const userTable = `${schema}.users`;

const AuthPlugin = makeExtendSchemaPlugin((build) => ({
	typeDefs: gql`
		input RegisterInput {
			username: String!
			email: String!
			password: String!
			confirmPassword: String!
		}
		type RegisterPayload {
			user: User! @pgField
		}
		input LoginInput {
			username: String!
			password: String!
		}
		type LoginPayload {
			user: User! @pgField
		}
		input LogoutInput {
			id: UUID!
		}
		type LogoutPayload {
			success: Boolean
		}

		# Pssword Reset
		input ForgotPasswordInput {
			email: String!
		}
		input ResetPasswordInput {
			id: UUID!
			token: String!
			password: String!
			confirmPassword: String!
		}
		input UpdatePasswordInput {
			id: UUID!
			password: String!
			confirmPassword: String!
		}
		input VerifyEmailInput {
			token: String!
		}
		type SuccessPayload {
			success: Boolean!
		}

		extend type Mutation {
			register(input: RegisterInput!): RegisterPayload
			login(input: LoginInput!): LoginPayload
			logout(input: LogoutInput!): LogoutPayload
			forgotPassword(input: ForgotPasswordInput!): SuccessPayload!
			resetPassword(input: ResetPasswordInput!): SuccessPayload!
			verifyEmail(input: VerifyEmailInput!): SuccessPayload!
			updatePassword(input: UpdatePasswordInput!): SuccessPayload!
		}
	`,
	resolvers: {
		Mutation: {
			async register(
				mutation,
				args,
				context,
				resolveInfo,
				{ selectGraphQLResultFromTable }
			) {
				const {
					username,
					password,
					email,
					confirmPassword,
				} = args.input;

				// Validate password
				validatePassword(password);
				let hashedPassword;
				if (password === confirmPassword) {
					hashedPassword = await argon2.hash(password);
				} else {
					throw new Error("Invalid confirm password.");
				}

				const { login, pgClient, cacher } = context;
				try {
					// Call our register function from the database
					const {
						rows: [user],
					} = await pgClient.query(
						`insert into ${userTable}(username, email, password)
            values ($1, LOWER($2), $3)
            on conflict do nothing
            returning ${userTable}.*`,
						[username, email, hashedPassword]
					);

					if (!user) {
						throw new Error("Registration failed");
					}

					// Tell Passport.js we're logged in
					if (login) {
						await login(user);
					}

					// Tell pg we're logged in
					if (cacher) {
						await cacher.set(
							getSessionCacheKey(user.id),
							getSessionParams(user)
						);
					}
					// await pgClient.query("select set_config($1, $2, true);", [
					// 	"jwt.claims.user_id",
					// 	user.id,
					// ]);

					// Fetch the data that was requested from GraphQL, and return it
					const sql = build.pgSql;
					const [row] = await selectGraphQLResultFromTable(
						sql.raw(`${userTable}`),
						(tableAlias, sqlBuilder) => {
							sqlBuilder.where(
								sql.fragment`${tableAlias}.id = ${sql.value(
									user.id
								)}`
							);
						}
					);

					return {
						data: row,
					};
				} catch (e) {
					throw new Error("Registration failed");
				}
			},
			async login(
				mutation,
				args,
				context,
				resolveInfo,
				{ selectGraphQLResultFromTable }
			) {
				const { username, password } = args.input;
				const { login, pgClient, cacher } = context;
				try {
					// Call our login function to find out if the username/password combination exists
					const user = await fetchUser({ username }, pgClient);

					if (!user || user.flagDelete) {
						throw new Error("Login failed");
					}

					const isValidPassword = await argon2.verify(
						user.password,
						password
					);
					if (!isValidPassword) {
						throw new Error("Login failed");
					}

					// Tell Passport.js we're logged in
					if (login) {
						await login(user);
					}

					// Tell pg we're logged in
					if (cacher) {
						await cacher.set(
							getSessionCacheKey(user.id),
							getSessionParams(user)
						);
					}
					// await pgClient.query("select set_config($1, $2, true);", [
					// 	"jwt.claims.user_id",
					// 	user.id,
					// ]);

					// Fetch the data that was requested from GraphQL, and return it
					const sql = build.pgSql;
					const [row] = await selectGraphQLResultFromTable(
						sql.raw(`${userTable}`),
						(tableAlias, sqlBuilder) => {
							sqlBuilder.where(
								sql.fragment`${tableAlias}.id = ${sql.value(
									user.id
								)}`
							);
						}
					);
					return {
						data: row,
					};
				} catch (e) {
					console.error(e);
					throw new Error(
						"Login failed: incorrect username/password"
					);
				}
			},

			async logout(mutation, args, context) {
				const { pgClient, logout, cacher } = context;
				const { id } = args.input;
				const user = await fetchUser({ id }, pgClient);

				const sessionKey = getSessionCacheKey(user.id);
				if (user) {
					if (cacher && (await cacher.get(sessionKey))) {
						await cacher.del(sessionKey);
					}
					if (logout) {
						await logout();
					}
					return {
						success: true,
					};
				} else {
					return {
						success: false,
					};
				}
			},

			async forgotPassword(mutation, args, context) {
				const { pgClient } = context;
				const { username } = args.input;
				try {
					// Check if email exist in accounts DB
					const user = await fetchUser({ username }, pgClient);
					if (!user) {
						throw new Error("Account doesn't exist.");
					}
					const token = userToAuthPayload(
						user,
						{
							expiresIn: "30m",
						},
						user.password
					);

					if (!token) {
						throw new Error("Failed to generate user token.");
					}

					// Send email
					// forgotPassword({
					//   ...getSessionParams(user),
					//   token
					// });

					return {
						success: true,
					};
				} catch (e) {
					throw new Error(e || "Password reset attempt failed.");
				}
			},

			async resetPassword(mutation, args, context) {
				const { pgClient } = context;
				const { id, token, password, confirmPassword } = args.input;
				try {
					validatePassword(password);

					const user = await validateUser(id, pgClient);
					if (!user) {
						throw new Error(
							"Account doesn't exist. Unable to reset password."
						);
					}

					// Verify token and user
					const verifiedToken = verifyToken(token, user.password);
					if (!verifiedToken) {
						throw new Error("Invalid token.");
					}

					// Check if email exist in accounts DB
					if (
						!password ||
						!confirmPassword ||
						password !== confirmPassword
					) {
						throw new Error(
							"Confirm password must be similar to new password."
						);
					}

					// Save new password for account
					const hashedPassword = await argon2.hash(password);
					const {
						rows: [updatedRow],
					} = await pgClient.query(
						`update ${userTable} set password = $1
            where id = $2
            returning ${userTable}.*`,
						[hashedPassword, user.id]
					);

					let success = false;
					if (updatedRow) {
						success = true;
						// Send reset password success email
						// confirmPasswordReset({
						// 	email: user.email,
						// 	fullName: user.full_name,
						// });
					}

					return {
						success,
					};
				} catch (e) {
					throw new Error(e || "Password reset attempt failed.");
				}
			},

			async updatePassword(mutation, args, context) {
				const { pgClient } = context;
				const { id, password, confirmPassword } = args.input;
				try {
					// Check if email exist in accounts DB
					if (
						!password ||
						!confirmPassword ||
						password !== confirmPassword
					) {
						throw new Error(
							"Confirm password must be similar to new password."
						);
					}

					validatePassword(password);

					// Save new password for account
					const hashedPassword = await argon2.hash(password);
					const {
						rows: [updatedRow],
					} = await pgClient.query(
						`update ${userTable} set password = $1
            where id = $2
            returning ${userTable}.*`,
						[hashedPassword, id]
					);

					let success = false;
					if (updatedRow) {
						success = true;
						// Send reset password success email
						// confirmPasswordReset({
						// 	email: updatedRow.email,
						// 	username: updatedRow.username,
						// });
					}

					return {
						success,
					};
				} catch (e) {
					throw new Error(e || "Password reset attempt failed.");
				}
			},

			async verifyEmail(mutation, args, context) {
				const { pgClient } = context;
				const { token } = args.input;

				try {
					const verifiedToken = verifyToken(token);
					if (!verifiedToken) {
						throw new Error("Invalid token.");
					}
					const user = await validateUser(pgClient, verifiedToken.id);
					if (!user) {
						throw new Error("Account doesn't exist.");
					}
					if (user.is_verified) {
						throw new Error("Email has already been verified.");
					}
					const {
						rows: [updatedRow],
					} = await pgClient.query(
						`update ${userTable} set email_is_verified = true
            where id = $1
            returning id, email`,
						[user.id]
					);
					return {
						success: !!updatedRow,
					};
				} catch (e) {
					throw new Error(e || "Email verification failed.");
				}
			},
		},
	},
}));
module.exports = AuthPlugin;
