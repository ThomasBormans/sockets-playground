'use strict';

var app = require('express')();
var express = require('express');
var path = require('path');
var server = require('http').Server(app);
var io = require('socket.io')(server);
var x = 20;
var y = 20;
var xDirection = 1;
var yDirection = 1;
var computers = [];
var activeScreen = null;
var copy;

app.use(express.static(path.join(process.cwd(), '/public')));

app.route('/').all(function(req, res) {
	res.sendFile(__dirname + '/public/index.html');
});

// Delete inactive computers
var checkActiveComputers = function checkActiveComputers() {
	// Get all clients
	var clients = io.sockets.clients();
	// Find the id's of the connected clients
	var keys = Object.keys(clients.connected);
	// Copy all computers
	copy = _.clone(computers);
	// Clear computers
	computers = [];
	_.forEach(keys, function(key) {
		// Check if the computer is found in the clone
		var item = _.find(copy, function(c) {
			return c.id === key;
		});
		// Add the computer if it is still active
		if(item) {
			computers.push(item);
		}
	});
};

// Move the ball
var move = function(id, x, y) {
	io.sockets.connected[id].emit('move', {x: x, y: y});
};

// Clear all canvas's
var clear = function() {
	io.sockets.emit('clear');
};

var loop;
var trigger = function(socket) {
	loop = setInterval(function() {
		var updateXDirection = false;
		var updateYDirection = false;
		var screenUpdated = false;
		var currentComputer;
		// Check if the current screen is still active
		if(computers[activeScreen] !== undefined) {
			// Copy the screen
			currentComputer = _.clone(computers[activeScreen]);
		} else {
			// Copy the previous screen
			currentComputer = _.clone(computers[activeScreen - 1]);
		}

		// Update x
		x = x + (5 * xDirection);
		// Update y
		y = y + (5 * yDirection);

		// Check if x is larger than the current screen width
		if(x >= currentComputer.width) {
			// If there is another screen
			if(computers.length - 1 > activeScreen) {
				// Set x to the beginning
				x = 0;
				// If the height of the current screen is larger than the following screen, set y to the bottom of the following screen
				if(y > computers[activeScreen + 1].height) {
					y = computers[activeScreen + 1].height;
					updateYDirection = true;
				}
				// Set active screen to the following screen
				activeScreen += 1;
				screenUpdated = true;
			} else {
				// We are at the final screen, just update the direction
				updateXDirection = true;
			}
		} else if(x < 0) {
			// Check if this is the first screen
			if(activeScreen === 0) {
				// Update the direction
				updateXDirection = true;
			} else {
				// Set previous screen
				activeScreen -= 1;
				screenUpdated = true;
				// Set x to the end of that screen
				x = currentComputer.width;
			}
		}

		// Check if we are at the end of the screen
		if(y >= currentComputer.height) {
			// Set y to the height of the screen
			y = currentComputer.height;
			// Update the direction
			updateYDirection = true;
		} else if(y <= 0) {
			// We are at the top of the screen
			updateYDirection = true;
		}

		// Update x if necessary
		if(updateXDirection) {
			xDirection = xDirection * -1;
			updateXDirection = false;
		}

		// Update y if necessary
		if(updateYDirection) {
			yDirection = yDirection * -1;
			updateYDirection = false;
		}

		// Clean canvas's only when the screen is updated
		if(screenUpdated) {
			// Clear all canvas's
			clear();
			screenUpdated = false;
		}

		// Move the ball
		if(computers[activeScreen] !== undefined) {
			move(computers[activeScreen].id, x, y);
		}
	}, 10);
};

io.on('connection', function(socket) {
	console.log('User with socket id ' + socket.id + ' connected.');

	socket.on('disconnect', function() {
		// Check if there is a computer left and the animation is running on the active screen
		if(computers.length > 0 && activeScreen && activeScreen !== 0 && socket.id === computers[activeScreen].id) {
			// Set to previous screen
			activeScreen = activeScreen - 1;
		}
		checkActiveComputers();
		// Stop the animation if there are no computers left
		if(computers.length === 0) {
			activeScreen = null;
			clearInterval(loop);
		}
		console.log('User with socket id ' + socket.id + ' disconnected.');
	});

	socket.on('updateClient', function(data) {
		data.id = socket.id;
		// Check if the screen already exists
		var index = _.findIndex(computers, function(c) {
			return c.id === socket.id;
		});
		// If it exists, update the computer
		if(~index) {
			computers[index] = data;
		} else {
			// Check if the `order` property was added
			if(data.hasOwnProperty('order')) {
				// Add the screen on a specific place in the array
				computers.splice(data.order, 0, data);
			} else {
				// Add the computer
				computers.push(data);
			}
			clear();
		}
		// If there is a computer, cancel all the things and start the animation
		if(computers.length === 1) {
			clearInterval(loop);
			activeScreen = 0;
			trigger(socket);
		}
	});
});

server.listen(4010, function() {
	console.log('Socket server listening on 4010.');
});

exports = module.exports = server;
