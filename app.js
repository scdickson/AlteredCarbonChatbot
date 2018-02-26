'use strict';

var request = require('request');
var express = require('express');
var bodyParser = require('body-parser')
var util = require('util');
var qs = require('querystring');
var url = require('url');
var datamuse = require('datamuse');
var toTitleCase = require('to-title-case');
var app = express().use(bodyParser.json());

var PORT = 8080; //Server port. Running nginx reverse proxy on port 80
var VERIFY_TOKEN = ""; //VERIFY TOKEN HERE
var PAGE_ACCESS_TOKEN = ""; //PAGE ACCESS TOKEN HERE

//Synonyms for "Altered"
var altered_syn = ['altered', 'changed', 'modified', 'adapted', 'transformed', 'converted', 'adjusted'];
//Synonyms for "Carbon"
var carbon_syn = ['carbon', 'element', 'body', 'person', 'component', 'ingredient', 'item', 'material'];

//Webhook for receivng messages
app.post('/webhook', (req, res) => {
	let body = req.body;
	if(body.object === 'page') {
			body.entry.forEach(function(entry) {
				let webhook_event = entry.messaging[0];
				let sender_psid = webhook_event.sender.id;
				if(webhook_event.message) {
					handleMessage(sender_psid, webhook_event.message);
				}
			});
			res.status(200).send('EVENT_RECEIVED');
	}
	else {
		res.sendStatus(404);
	}
});

//Webhook for verifying challenge
app.get('/webhook', (req, res) => {
	let mode = req.query['hub.mode'];
	let token = req.query['hub.verify_token'];
	let challenge = req.query['hub.challenge'];

	if(mode && token) {
		if(mode === 'subscribe' && token === VERIFY_TOKEN) {
			console.log('WEBHOOK_VERIFIED');
			res.status(200).send(challenge);
		}
		else {
			res.sendStatus(403);
		}
	}
});

//Returns a random word of a given part of speech that is not compound
function getRandomWord(json, partOfSpeech) {
	var possibilities = [];

	for(var i = 0; i < json.length; i++) {
		var word = json[i];
		if(word.tags) {
			if(word.tags.indexOf(partOfSpeech) > -1 && word.word.indexOf(" ") < 0) {
				possibilities.push(word.word);
			}
		}
	}
	return possibilities[Math.floor(Math.random()*possibilities.length)];
}

// Handles messages events
function handleMessage(sender_psid, received_message) {
	let response;
	if(received_message.text) {
		var altered = altered_syn[Math.floor(Math.random()*altered_syn.length)]; //Get a random synonym of "Altered"
		var carbon = carbon_syn[Math.floor(Math.random()*carbon_syn.length)]; //Get a random synonym of "Carbon"

		datamuse.request("words?ml=" + altered + "&sp=a*&max=2000&md=p").then((json) => {
			altered = getRandomWord(json, "adj");
			datamuse.request("words?ml=" + carbon + "&sp=c*&max=2000&md=p").then((json) => {
				carbon = getRandomWord(json, "n");

				response = {
					"text": toTitleCase(altered + " " + carbon)
				};
				callSendAPI(sender_psid, response);
			});
		});
	}
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
	let request_body = {
		"recipient": {
			"id": sender_psid
		},
		"message": response
	}

	request({
		"uri": "https://graph.facebook.com/v2.6/me/messages",
		"qs": { "access_token": PAGE_ACCESS_TOKEN },
		"method": "POST",
		"json": request_body
	}, (err, res, body) => {
		if(err) {
			console.log("Error sending response: " + err);
		}
	});
}

//Returns a blank privacy policy. Required to create Facebook app
app.get('/privacy', function(req, res)
{
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end("Privacy policy: None");
	return;
});

//Returns a blank terms of service. Required to create Facebook app
app.get('/tos', function(req, res)
{
	res.writeHead(200, {'Content-Type': 'text/plain'});
	res.end("Terms of Service: None");
	return;
});

//Catchall for other routes
app.get('*', function(req, res)
{
	res.writeHead(400, {'Content-Type': 'application/json'});
	res.end("Invalid Path");
	return;
});

//Set up server
var server = app.listen(PORT, function()
{
	var host = server.address().address
	var port = server.address().port
});

