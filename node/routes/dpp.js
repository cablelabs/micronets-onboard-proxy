/* dpp.js
 * 
 *  Gateway co-located endpoints specific to DPP operation
 */

'use strict';

const express = require('express');
const router = express.Router();
const session = require('express-session');
const URL = require('url');
const sessionCookieName = '3010.connect.sid'; 
const http = require('http');
const gateway = require('../lib/gateway')


// Note: we need httpOnly: false so that xhr login can store cookie.
//router.use(session({ secret: 'micronets-dpp', name: sessionCookieName, httpOnly: false }));
router.use(session({ secret: 'micronets-dpp', name: sessionCookieName }));

function checkAuth (req, res, next) {
	var urlPath = URL.parse(req.url).pathname;

	if (!req.session || !req.session.authenticated) {
		res.status(401).send('not authenticated');
	}
	else {
		next();
	}

	// We are logging in directly to the gateway's onboard proxy via IP address. For now, no user/password is required.
	// (this would require an admin portal to change the credentials)
	//next();
}

// Mobile config
router.get('/config', function(req, res, next) {
	(async() => {
		var config = {};
		config.deviceClasses = await gateway.fetchClassList();
		res.send(JSON.stringify(config));
	})();
});

// Session
router.get('/session', function(req, res, next) {
	res.end();
});

// POST dpp/onboard 
router.post('/onboard', checkAuth, function(req, res, next) {

	(async() => {
		console.log(`onboard: ${req.body.bootstrap.mac}  -  ${req.body.bootstrap.uri}`)

		// Note that deviceName is optional.
        await gateway.createDevice(req.body.bootstrap.mac, req.body.device.class, req.body.user.deviceName);
        await gateway.onboard(req.body.bootstrap.mac, req.body.device.class, req.body.bootstrap.uri, req.body.user.deviceName);

        console.log(JSON.stringify(req.body));
        res.end();
    })();
});

// POST submit login form
router.post('/login', function(req, res, next) {

	// For now, always log the user in. Ultimately, there should be a sticker on the gateway with 
	// login credentials, and an API to change them.
	// Shouldn't get here though, as /session always returns 200

    //const username = req.body.username.trim();
    //const password = req.body.password.trim();

    // Establish session
	//if (userInfo[username] && userInfo[username].password == password) {
	//if (username && password) {
	if (true) {
		// authorized, establish session
		req.session.username = "local";
		req.session.authenticated = true;
		res.status(201).end();
	}
	else {
		res.status(401).end();
	}

    // ***************************************************** //
});

// These two endpoints are used to kick the STA offline, (RECONFIG testing) so we can issue a CHIRP
router.post('/updateDevicePSK/:deviceId/:micronetId', function(req, res, next) {
    if (req.params.deviceId == undefined || req.params.micronetId == undefined) {
        // Invalid request.
        res.status(400);
        var error = {};
        error.error = "Device ID and/or Micronet ID not specified";
        error.status = 400;
        res.send(JSON.stringify(error, null, 2));
    }
    else {
		var device = gateway.updateDevicePSK(req.params.deviceId, req.params.micronetId);
		res.status(201).send(JSON.stringify(device,null,2));
    }
});

router.post('/deleteDevice/:deviceId/:micronetId', function(req, res, next) {
    if (req.params.deviceId == undefined || req.params.micronetId == undefined) {
        // Invalid request.
        res.status(400);
        var error = {};
        error.error = "Device ID and/or Micronet ID not specified";
        error.status = 400;
        res.send(JSON.stringify(error, null, 2));
    }
    else {
		gateway.deleteDevice(req.params.deviceId, req.params.micronetId);
		res.status(204).end();
    }
});

router.post('/logout', function(req, res, next) {
	if (!req.session || !req.session.authenticated) {
		res.status(200).end();  
	}
	else {
		req.session.destroy(function(err){  
	        if(err){  
	            res.status(500).send('failed to destroy session');
	        }  
	        else  
	        {  
	            res.status(204).end();  
	        }  
	    });  
	}
});

module.exports = router;


