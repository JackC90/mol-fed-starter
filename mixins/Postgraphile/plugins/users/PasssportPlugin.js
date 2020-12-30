import { gql, makeExtendSchemaPlugin } from "graphile-utils";
const argon2 = require("argon2");
const schema = process.env.ACCOUNTS_SCHEMA;
import { ERROR_MESSAGE_OVERRIDES } from "../utils/handleErrors";

const PassportLoginPlugin = makeExtendSchemaPlugin((build) => ({
	typeDefs: gql`
		input RegisterInput {
			username: String!
			email: String!
			password: String!
			name: String
			avatarUrl: String
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

		type LogoutPayload {
			success: Boolean
		}

		extend type Mutation {
			"""
			Use this mutation to create an account on our system. This may only be used if you are logged out.
			"""
			register(input: RegisterInput!): RegisterPayload
			"""
			Use this mutation to log in to your account; this login uses sessions so you do not need to take further action.
			"""
			login(input: LoginInput!): LoginPayload
			"""
			Use this mutation to logout from your account. Don't forget to clear the client state!
			"""
			logout: LogoutPayload
		}
	`,
	resolvers: {
		Mutation: {
			async register(_mutation, args, context, resolveInfo) {
				const { selectGraphQLResultFromTable } = resolveInfo.graphile;
				const { username, password, email } = args.input;
				const { rootPgPool, login, pgClient, cacher } = context;
				try {
					// Call our login function to find out if the username/password combination exists
					const {
						rows: [details],
					} = await rootPgPool.query(
						`insert into ${schema}.users(username, email, password)
            values ($1, LOWER($2), $3)
            on conflict do nothing
            returning ${schema}.users.*`,
						[username, email, password]
					);

					if (!details || !details.id || details.delete_flag) {
						const e = new Error("Registration failed");
						e["code"] = "FFFFF";
						throw e;
					}

					// Store into transaction
					cacher.set(`sessions.${details.id}`, "myvalue.a");
					await pgClient.query(
						`insert into ${schema}.sessions(username, email, full_name, user_type, country_code)
						values ($1, LOWER($2), $3)
						on conflict do nothing
						returning ${schema}.users.*`,
						[
							details.session_id,
							{
								username: details.username,
								email: details.email,
								fullName: details.full_name,
								userType: details.user_type,
								countryCode: details.user_type,
							},
						]
					);

					// Tell Passport.js we're logged in
					await login({ session_id: details.session_id });

					// Fetch the data that was requested from GraphQL, and return it
					const sql = build.pgSql;
					const [row] = await selectGraphQLResultFromTable(
						sql.fragment`app_public.users`,
						(tableAlias, sqlBuilder) => {
							sqlBuilder.where(
								sql.fragment`${tableAlias}.id = ${sql.value(
									details.user_id
								)}`
							);
						}
					);
					return {
						data: row,
					};
				} catch (e) {
					const { code } = e;
					const safeErrorCodes = [
						"WEAKP",
						"LOCKD",
						"EMTKN",
						...Object.keys(ERROR_MESSAGE_OVERRIDES),
					];
					if (safeErrorCodes.includes(code)) {
						throw e;
					} else {
						console.error(
							"Unrecognised error in PassportLoginPlugin; replacing with sanitized version"
						);
						console.error(e);
						const error = new Error("Registration failed");
						error["code"] = code;
						throw error;
					}
				}
			},
			async login(_mutation, args, context, resolveInfo) {
				const { selectGraphQLResultFromTable } = resolveInfo.graphile;
				const { username, password } = args.input;
				const { rootPgPool, login, pgClient } = context;
				try {
					// Call our login function to find out if the username/password combination exists
					const {
						rows: [session],
					} = await rootPgPool.query(
						`select sessions.* from app_private.login($1, $2) sessions where not (sessions is null)`,
						[username, password]
					);

					if (!session) {
						const error = new Error("Incorrect username/password");
						error["code"] = "CREDS";
						throw error;
					}

					if (session.uuid) {
						// Tell Passport.js we're logged in
						await login({ session_id: session.uuid });
					}

					// Get session_id from PG
					await pgClient.query(
						`select set_config('jwt.claims.session_id', $1, true)`,
						[session.uuid]
					);

					// Fetch the data that was requested from GraphQL, and return it
					const sql = build.pgSql;
					const [row] = await selectGraphQLResultFromTable(
						sql.fragment`app_public.users`,
						(tableAlias, sqlBuilder) => {
							sqlBuilder.where(
								sql.fragment`${tableAlias}.id = app_public.current_user_id()`
							);
						}
					);
					return {
						data: row,
					};
				} catch (e) {
					const { code } = e;
					const safeErrorCodes = ["LOCKD", "CREDS"];
					if (safeErrorCodes.includes(code)) {
						throw e;
					} else {
						console.error(e);
						const error = new Error("Login failed");
						error["code"] = e.code;
						throw error;
					}
				}
			},

			async logout(_mutation, _args, context, _resolveInfo) {
				const { pgClient, logout } = context;
				await pgClient.query("select app_public.logout();");
				await logout();
				return {
					success: true,
				};
			},
		},
	},
}));

module.exports = PassportLoginPlugin;
