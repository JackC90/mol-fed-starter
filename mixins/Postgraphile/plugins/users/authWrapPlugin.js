const { makeWrapResolversPlugin } = require("graphile-utils");
const { validateUser } = require.main.require("./utils/auth");
const get = require("lodash.get");

const publicMutFields = [
	"register",
	"login",
	"forgotPassword",
	"resetPassword",
];
const publicQueFields = [];
const userFields = ["users", "user", "updateUser", "updatePassword"];

module.exports = {
	// Authenticate
	authorize: makeWrapResolversPlugin(
		(context) => {
			const { scope } = context;
			if (
				scope.isRootMutation &&
				!publicMutFields.includes(scope.fieldName)
			) {
				return { scope };
			}
			if (
				scope.isRootQuery &&
				!publicQueFields.includes(scope.fieldName)
			) {
				return { scope };
			}
			return null;
		},
		() => {
			return async (resolver, source, args, context, resolveInfo) => {
				const { pgClient, user } = context;
				if (!user) {
					throw new Error("Access denied");
				}
				const validatedUser = await validateUser(pgClient, user.id);
				if (!validatedUser) {
					throw new Error("Access denied");
				}

				const result = await resolver();
				return result;
			};
		}
	),

	// Check nested fields
	user: makeWrapResolversPlugin(
		(context) => {
			const { scope } = context;
			if (userFields.includes(scope.fieldName)) {
				return { scope };
			}
			return null;
		},
		(match) => {
			return async (resolver, source, args, context, resolveInfo) => {
				const { user } = context;
				const argUserId = args.id || get(args, "input.id");
				if (argUserId && !(user && user.id && argUserId === user.id)) {
					throw new Error("Invalid user access");
				}
				if (resolveInfo && resolveInfo.fieldName === "updateUser") {
					const patch = get(args, "input.patch");
					for (const property in patch) {
						if (property === "password") {
							throw new Error("Password update not allowed");
						}
					}
				}
				const result = await resolver();
				return result;
			};
		}
	),
};
