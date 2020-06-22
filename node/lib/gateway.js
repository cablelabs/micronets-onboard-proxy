/* gateway.js 
 * REST interface to the Micronets Gateway
 * Normally this will run on the gateway device, but can be run externally if the "gateway" envvar is set to point to the gateway IP address
 */

const request = require('request-promise');
const generatePassword = require('password-generator');

var self = module.exports = {

	gateway: "localhost",
	micronets: [],	// Array of known micronets.
	testing: true,	// Temp for development
	interface: "wlp2s0",

	// Fetch/create list of micronets available for the onboarding device
	initialize: async function () {

		// Allow for testing external to gateway
		if (process.env.gateway) {
			self.gateway = process.env.gateway;
		}

		// Get our gateway's wifi adaptor
		await fetchInterfaceId();

		console.log("Initializing: get/set list of micronets(classes)");

		if (self.testing) {
			// delete all micronets
			await self.deleteMicronets();

			// test establishment of micronets by way of fetchClassList (which will normally occur when a mobile device configurator app initializes)
			var list = await self.fetchClassList();
			console.log("Available Micronets(device classes): "+JSON.stringify(list));

			// test creation of a micronet device on the gateway
			await self.createDevice("46:56:09:45:16:17", "Personal","myPhone");
		}	
	},
	// Return a list of micronets (device classes) to the mobile app
	fetchClassList: async function() {
		await establishMicronets();
		list = [];
		if (self.micronets.length == 0) {
			list.push("No Micronets ☹️");
		}
		else {
			self.micronets.forEach(function (micronet, index) {
  				list.push(micronet.micronetId);
			});
		}
		return list;
	},
	// Create (delete if exists) a micronet on the gateway
	createMicronet: async function(micronetId, subnet) {

		// delete pre-emptively
		await self.deleteMicronet(micronetId);
		
		// Create new micronet
		body = {
		    "micronet": {
		        "micronetId": micronetId,
		        "ipv4Network": {
		            "network": "10.135."+subnet+".0",
		            "mask": "255.255.255.0",
		            "gateway":"10.135."+subnet+".1"
		        },
		        "interface": self.interface,
		        "vlan": 100+subnet
		    }
		};

		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets`;
			self.micronet = await request({uri: uri, headers: "application/json", method: "POST", json: body});
			console.log("Micronet created: "+JSON.stringify(self.micronet));
		} catch (e) {
			if (e.statusCode != 201) {
				console.log("Unable to create micronet: "+JSON.stringify(e));					
			}
		} 
	},
	// Delete micronet on the gateway
	deleteMicronet: async function(micronetId) {
		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}`;
			await request({uri: uri,	method: "DELETE"});
		} catch (e) {
			if (e.statusCode != 404 && e.statusCode != 204) {
				console.log("Unable to delete micronet: "+JSON.stringify(e));					
			}
		} 
	},
	// Delete all micronets on the gateway
	deleteMicronets: async function() {
		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets`;
			await request({uri: uri,	method: "DELETE"});
		} catch (e) {
			if (e.statusCode != 404 && e.statusCode != 204) {
				console.log("Unable to delete (all) micronets: "+JSON.stringify(e));					
			}
		} 
	},
	// Create a device record on the gateway prior to onboarding
	createDevice: async function(mac, micronetId, deviceName) {

		// We persist the last created deviceID for testing purposes (e.g. modifying the PSK)
		var deviceId = await deriveDeviceId(mac, deviceName);

		// Ensure we start off empty
		await self.deleteDevice(self.deviceId, micronetId);

		var passphrase = generatePassword();
		var ipv4 = await assignIPAddress(micronetId);


		body = {
		    "device": {
		        "deviceId": deviceId,
		        "macAddress": {
		           "eui48": mac
		        },
		        "networkAddress": {
		           "ipv4": ipv4
		        },
		        "psk": passphrase,
		    }
		}

		// wait for Craig to enable this: 
		if (false && deviceName != undefined) {
			body.device.deviceName = deviceName;
		}

		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}/devices`;
			response = await request({uri: uri, headers: "application/json", method: "POST", json: body});
			var device = response;
			console.log("Device created: "+JSON.stringify(device));
			return device;
		} catch (e) {
			if (e.statusCode != 201) {
				console.log("Unable to create device: "+JSON.stringify(e) + " - " + e.statusCode);					
			}
		} 
		return null;
	},
	// Delete a device record on the gateway
	deleteDevice: async function(deviceId, micronetId) {
		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}/devices/${deviceId}`;
			response = await request({uri: uri,	method: "DELETE"});
		} catch (e) {
			if (e.statusCode != 404 && e.statusCode != 204) {
				console.log("Unable to delete device: "+JSON.stringify(e));					
			}
		} 
	},
	// Fetch a device record from the gateway
	getDevice: async function(deviceId, micronetId) {
		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}/devices/${deviceId}`;
			var reply = await request({uri: uri,	method: "GET"});
			return JSON.parse(reply);
		} catch (e) {
			if (e.statusCode != 200) {
				console.log("Unable to get device: "+JSON.stringify(e));
				return null;				
			}
		} 
	},
	// Change the PSK for a device, to test the DPP RECONFIG functionality
	updateDevicePSK: async function(deviceId, micronetId) {
		try {
			var device = await self.getDevice(deviceId, micronetId);
			device.device.psk = generatePassword();
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}/devices/${deviceId}`;
			var device2 = await request({uri: uri,	method: "PUT", json: device});
			console.log("Device PSK Updated: "+device2.device.psk);
			return device;
		} catch (e) {
			if (e.statusCode != 200) {
				console.log("Unable to update PSK: "+e.statusCode);					
			}
		} 
	},
	// Initiate a device onboard operation. 
	// - A micronet must exist on the gateway for the referenced device class
	// - A device record is must already exist on the gateway with a MAC address, PSK (passphrase) and reserved IP address
	onboard: async function(mac, micronetId, uri) {

		var deviceId = await deriveDeviceId(mac);

		// Note: Until DPP V2, we have to ask for the DPP connector explicitly (needed for RECONFIG) even though we just want to 
		// use PSK alone. But DPP + PSK is not a valid combination, so in the short term, we need to ask for PSK + DPP + SAE.

		body = {
		    "dpp": {
		    	"akms": ["psk", "dpp", "sae"],
		        "uri": uri
		    }
		}

		try {
			uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}/devices/${deviceId}/onboard`;
			await request({uri: uri,	method: "PUT", json: body});
			console.log("DPP Onboard Initiated:");	
			console.log(JSON.stringify(body));				
		} catch (e) {
			if (e.statusCode != 200) {
				console.log("Unable to initiate onboard: "+JSON.stringify(e));					
			}
		} 
	}
}

// non-exported functions
function findMicronet(micronetId) {
	var ret = null;
	self.micronets.forEach(function(micronet, index) {
		if (micronet.micronetId == micronetId) {
			ret = micronet;
		}
	});
	return ret;
}

// This may change in the future to be based on pubkey or a guid (non-DPP)
async function deriveDeviceId(mac) {
	//var tokens = mac.split(":");
	//return "device"+tokens[4]+tokens[5];
	var deviceId =  mac.replace(/:/g, "")
	console.log(deviceId);
	return deviceId;
}

function fetchInterfaceId() {
	// TBD, waiting for gateway update. Use wlp2s0 for now.
	self.interface = "wlp2s0";
}

// Get the first available IP address available for this micronet (subnet)
async function assignIPAddress(micronetId) {
	try {
		// Get list of addresses in use
		uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets/${micronetId}/devices`;
		var reply = await request({uri: uri, headers: "application/json", method: "GET"});
		reply = JSON.parse(reply);
		var blocked = [];

		reply.devices.forEach(function(device, index) {
			blocked.push(device.networkAddress.ipv4)
		});

		// Get our base address
		var micronet = findMicronet(micronetId);
		var gateway = micronet.ipv4Network.gateway;
		var tuples = gateway.split(".");
		var i = parseInt(tuples[3])+1; // lease significant tuple (of gateway IP), as integer, plus one == first valid assigned IP address

		// Get max subnet address
		var max = 255 - parseInt(micronet.ipv4Network.mask.split('.')[3]);

		for (i; i < max; i++) {
			var proposed = ""+tuples[0]+'.'+tuples[1]+'.'+tuples[2]+'.'+i;
			//console.log("proposing: "+proposed);
			if (blocked.indexOf(proposed) == -1) {
				//console.log("accepted: "+ proposed);
				return proposed;
			}
		}
		// No available IP addresses in this subnet
		console.log("no ip addresses available");
	} catch (e) {
		console.log("Unable to assign IP address: "+e);
	}
	return null;
}

// If no micronets exist yet, create our default micronets on the gateway
// TODO: Put these in a configuration file.
async function defaultMicronets() {
	await self.createMicronet("Security",1);
	await self.createMicronet("Medical",2);
	await self.createMicronet("Personal",3);
	await self.createMicronet("Generic",4);
	await self.createMicronet("Shared",5);
}

// We need a list of available micronets to populate the mobile "device class" list.
async function fetchMicronets() {
	try {
		uri = `http://${self.gateway}:5000/micronets/v1/gateway/micronets`;
		var reply = await request({uri: uri, method: "GET"});
		reply.replace("\n","");
		reply = JSON.parse(reply);
		//console.log(JSON.stringify(reply,null,2));
		self.micronets = reply.micronets;

		//console.log("Fetching Available Micronets(device classes): "+JSON.stringify(self.fetchClassList()));
	} catch (e) {
		console.log("Unable to get micronets list: "+JSON.stringify(e));					
		self.micronets = [];

	} 
}

// Fetch list of micronets, create defaults if none exist yet.
async function establishMicronets() {
	// Get list of micronets
	await fetchMicronets();
	// If no micronets, create defaults
	if (self.micronets.length == 0) {
		await defaultMicronets();
		// - Retry list of micronets
		await fetchMicronets();

		// If no micronets, error. iPhone will show no available micronets.
		if (self.micronets.length == 0) {
			console.log("No micronets available")
		}
	}
}
//self.initialize();

