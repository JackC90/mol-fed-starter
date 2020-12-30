require("dotenv").config();
const fs = require("fs");

const get = require("lodash.get");

const { NODE_ENV: env, ACCOUNTS_SCHEMA: accSchema } = process.env;
const isDevMode = env === "development" || false;
const configs = require("../../config/database")[env];
const pgConfig = {
	connectionString: configs.url,
};

// Imported
const express = require("express");
const cors = require("cors");

const { postgraphile } = require("postgraphile");
const { makePgSmartTagsFromFilePlugin } = require("postgraphile/plugins");
const ConnectionFilterPlugin = require("postgraphile-plugin-connection-filter");
const PgManyToManyPlugin = require("@graphile-contrib/pg-many-to-many");
const SimplifyPlugin = require("@graphile-contrib/pg-simplify-inflector");
const { default: FederationPlugin } = require("@graphile/federation");

// Local
const usersPlugin = [
	require("./plugins/users/authPlugin"),
	// require("./PostgraphilePlugins/auth/authWrapPlugin"),
];

const defaultOptions = {
	watchPg: true,
	retryOnInitFail: true,
	graphiql: isDevMode,
	enhanceGraphiql: isDevMode,
	graphiqlRoute: "/schema",
	setofFunctionsContainNulls: false,
	dynamicJson: true,
	disableQueryLog: !isDevMode,
	enableQueryBatching: true,
	legacyRelations: "omit",
	extendedErrors: isDevMode ? ["hint", "errcode"] : ["errcode"],
};

const defaultAppendPlugins = [
	ConnectionFilterPlugin,
	SimplifyPlugin,
	PgManyToManyPlugin,
	FederationPlugin,
];

const postgraphileOptions = (name, broker) => {
	const options = { ...defaultOptions };
	const appendPlugins = [...defaultAppendPlugins];

	// Add Auth plugins
	if (name === "users") {
		appendPlugins.push(...usersPlugin);
		options.additionalGraphQLContextFromRequest = (res) => {
			const cacher = get(broker, "cacher");
			return {
				cacher,
			};
		};
	}

	// Add smart tags
	const tagsPath = `${__dirname}/plugins/${name}/tags.json5`;
	if (fs.existsSync(tagsPath)) {
		const smartTagsPlugin = makePgSmartTagsFromFilePlugin(tagsPath);
		appendPlugins.push(smartTagsPlugin);
	}

	return {
		...options,
		appendPlugins,
	};
};

const getPgSchema = (name) => {
	switch (name) {
		case "users":
			return accSchema;
		default:
			return "public";
	}
};

const PostgraphileService = {
	name: "PostgraphileService",
	metadata: {
		federatedService: true,
		graphqlPath: "/graphql",
	},
	methods: {
		async initServer() {
			const { port } = this.settings;
			const { name, broker } = this;
			const app = express();

			app.use(cors()).use(
				postgraphile(
					pgConfig,
					getPgSchema(name),
					postgraphileOptions(name, broker)
				)
			);
			await app.listen(port);
			return {
				app,
			};
		},
	},
	actions: {},
	async started() {
		const { name } = this;
		const { app } = await this.initServer();
		this.settings.server = app;
		this.broker.emit(`${name}.started`);
	},
	async stopped() {
		const { name } = this;
		if (this.settings.server) {
			this.logger.info(`Shutting down ${name} service`);
			await this.settings.server.close();
		}
	},
};

module.exports = PostgraphileService;
