"use strict";

/*
 * Created with @iobroker/create-adapter v2.0.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios = require("axios");
const {clearTimeout} = require("timers");

// Load your modules here, e.g.:
// const fs = require("fs");


class WebfuelAdapter extends utils.Adapter {

	get_timeout(to = 1000) {
		const instance = this;
		instance.log.info("aktiviere Timer mit " + to + " ms");
		return new Promise(function (resolve) {
			setTimeout(() => {
				instance.log.info("Timer abgelaufen");
				resolve;
			}, to);
		});
	}

	async get_token() {
		// noinspection ExceptionCaughtLocallyJS
		try {
			if (this.http_client === null || this.http_client === undefined) {
				throw  new Error("keine Client-Instanz");
			}
			const response = await this.http_client.post("/access/login", {
				username: this.config.username,
				password: this.config.password
			});
			this.log.info("Token-Response: " + JSON.stringify(response.data));
			this.token = {
				access_token: response.data.access_token,
				refresh_token: response.data.refresh_token
			};
			this.setState("info.connection", true, true);
			this.refresh_timer = setTimeout(() => {
				this.refresh_token().finally(() => {
				});
			}, response.data.expires_in * 800);
		} catch (error) {
			this.log.error("Request-Error " + error.message);
			this.token = undefined;
			this.setState("info.connection", false, true);
		}
	}

	async refresh_token() {
		// noinspection ExceptionCaughtLocallyJS
		try {
			if (this.http_client === null || this.http_client === undefined) {
				throw  new Error("keine Client-Instanz");
			}
			this.log.info("Aktualisiere Access-Token");
			const response = await this.http_client.post("/access/refresh",
				"grant_type=refresh_token&refresh_token=" + encodeURIComponent(this.token.refresh_token)
				, {
					headers: {
						"Authorization": "Bearer " + this.token.access_token
					}
				});
			this.log.info("Token-Response: " + JSON.stringify(response.data));
			this.token = {
				access_token: response.data.access_token,
				refresh_token: response.data.refresh_token
			};
			this.setState("info.connection", true, true);
			//response.data.expires_in * 800
			const instance = this;
			this.refresh_timer = setTimeout(() => {
				instance.refresh_token().finally(() => {
				});
			}, response.data.expires_in * 800);
		} catch (error) {
			this.log.error("Request-Error " + error.message);
			this.token = undefined;
			this.setState("info.connection", false, true);

		}
	}

	set_number_state(path, n, role = "value") {
		this.setObjectNotExistsAsync(path, {
			type: "state",
			common: {
				name: path,
				type: "number",
				role: role,
				read: true,
				write: true,
			},
			native: {},
		}).finally(() => {
			this.setState(path, n, {ack: true});
		});
	}

	set_text_state(path, n, role = "value") {
		this.setObjectNotExistsAsync(path, {
			type: "state",
			common: {
				name: path,
				type: "string",
				role: role,
				read: true,
				write: true,
			},
			native: {},
		}).finally(() => {
			this.setState(path, n, {ack: true});
		});
	}

	set_date_state(path, n, role = "value") {
		this.setObjectNotExistsAsync(path, {
			type: "state",
			common: {
				name: path,
				type: "string",
				role: role,
				read: true,
				write: true,
			},
			native: {},
		}).finally(() => {
			this.setState(path, n, {ack: true});
		});
	}

	set_boolean_state(path, n, role = "indicator") {
		this.setObjectNotExistsAsync(path, {
			type: "state",
			common: {
				name: path,
				type: "boolean",
				role: role,
				read: true,
				write: true,
			},
			native: {},
		}).finally(() => {
			this.setState(path, n, {ack: true});
		});
	}

	async request_probe_data() {
		this.probe_interval = null;
		// noinspection ExceptionCaughtLocallyJS
		try {
			if (this.http_client === null || this.http_client === undefined) {
				throw  new Error("keine Client-Instanz");
			}
			this.log.info("hole PROBE-Daten");
			const pids = this.config.probe_ids.split(",");
			for (let i = 0; i < pids.length; i++) {
				const pid = pids[i].trim();
				if (pid === "") {
					continue;
				}
				this.http_client.get("/api/slm/probes/" + encodeURIComponent(pid),
					{
						headers: {
							"Authorization": "Bearer " + this.token.access_token
						}
					}).then((p) => {
					this.log.debug(JSON.stringify(p.data));
					const sonde = p.data;
					if (sonde !== null && sonde !== undefined && sonde.id !== null && sonde.id !== undefined && ("" + sonde.id).trim() === pid) {
						this.set_number_state("probes." + sonde.id + ".id", sonde.id);
						this.set_number_state("probes." + sonde.id + ".nummer", sonde.nummer);
						this.set_text_state("probes." + sonde.id + ".name", sonde.display_text);
						this.set_number_state("probes." + sonde.id + ".station_id", sonde.station);
						this.set_number_state("probes." + sonde.id + ".terminal_id", sonde.terminal_id);
						this.set_number_state("probes." + sonde.id + ".last_booking_id", sonde.last_booking_id);
						this.set_date_state("probes." + sonde.id + ".last_booking", sonde.last_booking);
						this.set_date_state("probes." + sonde.id + ".letzte_peilung", sonde.last_dipping);
						this.set_date_state("probes." + sonde.id + ".naechste_peilung", sonde.next_dipping);
						if (sonde.last_booking_id > 0) {
							this.http_client.get("/api/slm/probe-bookings/" + encodeURIComponent(sonde.last_booking_id),
								{
									headers: {
										"Authorization": "Bearer " + this.token.access_token
									}
								}).then((pl) => {
								this.log.debug(JSON.stringify(pl.data));
								const peilung = pl.data;
								if (peilung !== null && peilung !== undefined && peilung.id === sonde.last_booking_id) {
									this.set_number_state("probes." + sonde.id + ".last_booking.id", peilung.id);
									this.set_date_state("probes." + sonde.id + ".last_booking.zeitpunkt", peilung.zeitpunkt);
									this.set_number_state("probes." + sonde.id + ".last_booking.temperatur", peilung.temperatur);
									this.set_number_state("probes." + sonde.id + ".last_booking.sumpf", peilung.sumpf);
									this.set_number_state("probes." + sonde.id + ".last_booking.hoehe", peilung.hoehe);
									this.set_number_state("probes." + sonde.id + ".last_booking.menge", peilung.menge);
									this.set_number_state("probes." + sonde.id + ".last_booking.max_hoehe", peilung.max_hoehe);
									this.set_number_state("probes." + sonde.id + ".last_booking.max_menge", peilung.max_menge);
									this.set_number_state("probes." + sonde.id + ".last_booking.menge_15c", peilung.menge_15c);
									this.set_number_state("probes." + sonde.id + ".last_booking.dichte", peilung.dichte);
									this.set_number_state("probes." + sonde.id + ".last_booking.dichte_15c", peilung.dichte_15c);
									this.set_number_state("probes." + sonde.id + ".last_booking.schall", peilung.schall);
									this.set_number_state("probes." + sonde.id + ".last_booking.spannung", peilung.spannung);
									this.set_number_state("probes." + sonde.id + ".last_booking.fehler_code", peilung.fehler_code);
									this.set_boolean_state("probes." + sonde.id + ".last_booking.requested", peilung.requested);
									this.set_boolean_state("probes." + sonde.id + ".last_booking.significant_changes", peilung.significant_changes);
								} else {
									this.deleteState("probes." + sonde.id + ".last_booking.*");
								}
							});
						}
					}
				});

			}
			/*
			const response = await this.http_client.post("/access/refresh",
				"grant_type=refresh_token&refresh_token=" + encodeURIComponent(this.token.refresh_token)
				, {
					headers: {
						"Authentication": "Bearer " + this.token.access_token
					}
				});
			this.log.info("Token-Response: " + JSON.stringify(response.data));
			this.token = {
				access_token: response.data.access_token,
				refresh_token: response.data.refresh_token
			};
			this.setState("info.connection", true, true);
			//response.data.expires_in * 800
			 */
		} catch (error) {
			this.log.error("Request-Error " + error.message);
			this.token = undefined;
			this.setState("info.connection", false, true);
		}


		this.start_probe_timer();
	}

	start_probe_timer() {
		const instance = this;
		if (instance.probe_interval !== null && instance.probe_interval !== undefined) {
			clearTimeout(instance.probe_interval);
		}
		instance.probe_interval = setTimeout(() => {
			instance.probe_timer_was_started_once = true;
			instance.request_probe_data().finally(() => {
			});
		}, (!instance.probe_timer_was_started_once) ? 100 : parseInt("" + instance.config.probe_interval, 10) * 1000);
	}


	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	constructor(options) {
		super({
			...options,
			name: "webfuel-adapter",
		});
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		// this.on("objectChange", this.onObjectChange.bind(this));
		// this.on("message", this.onMessage.bind(this));
		this.on("unload", this.onUnload.bind(this));
		this.probe_interval = undefined;
		this.refresh_timer = undefined;
		this.probe_timer_was_started_once = false;
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	async onReady() {
		// Initialize your adapter here

		// Reset the connection indicator during startup
		this.setState("info.connection", false, true);

		// The adapters config (in the instance object everything under the attribute "native") is accessible via
		// this.config:
		this.log.info("config API-URL            : " + this.config.api_url);
		this.log.info("config APP-ID             : " + this.config.app_id);
		this.log.info("config USERNAME           : " + this.config.username);
		this.log.info("config PASSWORD           : " + ("" + this.config.password).length + " Zeichen");
		this.log.info("config PROBE-IDs          : " + this.config.probe_ids);
		this.log.info("config PROBE-Abrufinterval: " + this.config.probe_interval);
		/*
		For every state in the system there has to be also an object of type state
		Here a simple template for a boolean variable named "testVariable"
		Because every adapter instance uses its own unique namespace variable names can't collide with other adapters variables
		*/
		//await this.setObjectNotExistsAsync("testVariable", {
		//	type: "state",
		//	common: {
		//		name: "testVariable",
		//		type: "boolean",
		//		role: "indicator",
		//		read: true,
		//		write: true,
		//	},
		//	native: {},
		//});

		// In order to get state updates, you need to subscribe to them. The following line adds a subscription for our variable we have created above.
		// this.subscribeStates("testVariable");
		// You can also add a subscription for multiple states. The following line watches all states starting with "lights."
		// this.subscribeStates("lights.*");
		// Or, if you really must, you can also watch all states. Don't do this if you don't need to. Otherwise this will cause a lot of unnecessary load on the system:
		// this.subscribeStates("*");

		this.subscribeStates("info.connection");


		/*
			setState examples
			you will notice that each setState will cause the stateChange event to fire (because of above subscribeStates cmd)
		*/
		// the variable testVariable is set to true as command (ack=false)
		//await this.setStateAsync("testVariable", true);

		// same thing, but the value is flagged "ack"
		// ack should be always set to true if the value is received from or acknowledged from the target system
		//await this.setStateAsync("testVariable", { val: true, ack: true });

		// same thing, but the state is deleted after 30s (getState will return null afterwards)
		//await this.setStateAsync("testVariable", { val: true, ack: true, expire: 30 });

		// examples for the checkPassword/checkGroup functions
		//let result = await this.checkPasswordAsync("admin", "iobroker");
		//this.log.info("check user admin pw iobroker: " + result);

		//result = await this.checkGroupAsync("admin", "admin");
		//this.log.info("check group user admin group admin: " + result);

		//const instance = this;
		try {
			// @ts-ignore
			this.http_client = axios.create({
				baseURL: this.config.api_url
			});
			this.http_client.defaults.headers.common["X-App-Token"] = this.config.app_id;

			await this.get_token();

			if (this.token !== undefined && this.token !== null && this.token !== "") {
				this.setState("info.connection", true, true);
			}
		} catch (error) {
			this.log.error("Initialization Error: " + error.message);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 * @param {() => void} callback
	 */
	onUnload(callback) {
		try {
			this.http_client = null;
			if (this.refresh_timer !== null && this.refresh_timer !== undefined) {
				clearTimeout(this.refresh_timer);
			}
			if (this.probe_interval !== null && this.probe_interval !== undefined) {
				clearTimeout(this.probe_interval);
			}
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (e) {
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  * @param {string} id
	//  * @param {ioBroker.Object | null | undefined} obj
	//  */
	// onObjectChange(id, obj) {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 * @param {string} id
	 * @param {ioBroker.State | null | undefined} state
	 */
	onStateChange(id, state) {
		if (state) {
			if (id.endsWith("info.connection")) {
				if (state.val === true || state.val === "true") {
					this.start_probe_timer();
				} else {
					if (this.probe_interval !== null && this.probe_interval !== undefined) {
						clearTimeout(this.probe_interval);
						this.probe_interval = null;
					}
				}
			}
			// The state was changed
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			// The state was deleted
			this.log.info(`state ${id} deleted`);
		}
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  * @param {ioBroker.Message} obj
	//  */
	// onMessage(obj) {
	// 	if (typeof obj === "object" && obj.message) {
	// 		if (obj.command === "send") {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info("send command");

	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, "Message received", obj.callback);
	// 		}
	// 	}
	// }

}

if (require.main !== module) {
	// Export the constructor in compact mode
	/**
	 * @param {Partial<utils.AdapterOptions>} [options={}]
	 */
	module.exports = (options) => new WebfuelAdapter(options);
} else {
	// otherwise start the instance directly
	new WebfuelAdapter();
}
