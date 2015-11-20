/*
 *	Copyright 2015, Maxime Journaux <journaux.maxime@gmail.com>
 * 	This work is free. You can redistribute it and/or modify it under the
 *	terms of the Do What The Fuck You Want To Public License, Version 2,
 *	as published by Sam Hocevar. 
 *	See http://www.wtfpl.net for more details.
 */

var PPM_RAW 	= 0x00;
var PPM_PLAIN 	= 0x01;

var DECODER_STATE = {
	TYPE: 		0x100,
	COMMENT: 	0x101,
	WIDTH: 		0x102,
	HEIGHT: 	0x103,
	MAXVAL: 	0x104,
	RGB: 		0x105
}

var CHAR = {
	TAB: 	0x9,
	LF: 	0xa,
	VT: 	0xb,
	FF: 	0xc,
	CR: 	0xd,
	SPACE: 	0x20,

	"#": 	0x23,
	P: 		0x50,
	"3": 	0x33,
	"6": 	0x36,
}

function initImage() {
	return {
		width: null,
		height: null,
		buffer: null,
		maxval: null,
		type: null,
	};
}

var PPMDecoder = function() {
	this.raw = null;
	this.state = DECODER_STATE.TYPE;
	this.oldstate = this.state;
	this.twobits = false;
	this.image = initImage();
}

PPMDecoder.prototype.decode = function() {
	for(var i=0; i < this.raw.length; i++) {
		// check if current is a comment start (0x23 = #)
		if(this.raw[i] == CHAR["#"] && this.state != DECODER_STATE.COMMENT) {
			if(this.image.type != PPM_RAW && this.state != DECODER_STATE.RGB) {
				this.oldstate = this.state;
				this.state = DECODER_STATE.COMMENT;
			}
		}
		if(this.image.type != PPM_RAW && this.state != DECODER_STATE.RGB)
			while(isWhiteSpace(this.raw[i]))
				i++;
		switch(this.state) {
			case DECODER_STATE.TYPE:
				i = decodeStateType(this, i);
				break;
			case DECODER_STATE.COMMENT:
				i = decodeStateComment(this, i);
				break;
			case DECODER_STATE.WIDTH:
				i = decodeStateWidth(this, i);
				break;
			case DECODER_STATE.HEIGHT:
				i = decodeStateHeight(this, i);
				this.image.buffer = new Buffer(this.image.width*this.image.height*3);
				this.image.index = 0;
				break;
			case DECODER_STATE.MAXVAL:
				i = decodeStateMaxval(this, i);
				break;
			case DECODER_STATE.RGB:
				if(this.image.type == PPM_PLAIN)
					i = decodeStateRGBPlain(this, i);
				else
					i = decodeStateRGBRaw(this, i);
				break;
		}
	}
	return {
		buffer: this.image.buffer,
		width: this.image.width,
		height: this.image.height
	}
}

function decodeStateType(decoder, i) {
	var d = decoder.raw[i];
	// check current is P
	if(d != CHAR.P)
		throw new Error("[TYPE] Seek [" + CHAR.P + "], get [" + d + "]");

	d = decoder.raw[++i];

	// check type 3=plain 6=raw
	switch(d) {
		case CHAR["3"]:
			decoder.image.type = PPM_PLAIN;
			break;
		case CHAR["6"]:
			decoder.image.type = PPM_RAW;
			break;
		default:
			throw new Error("[TYPE] Seek [" + CHAR["3"] + "] or [" + CHAR["6"] + "], get [" + d + "]");
	}
	
	decoder.state = DECODER_STATE.WIDTH;
	
	d = decoder.raw[++i];
	if(d == CHAR["#"]) {
		decoder.oldstate = decoder.state;
		decoder.state = DECODER_STATE.COMMENT;
		return --i;
	}

	// check next is space, CR, LF or tab
	if(!isWhiteSpace(d))
		throw new Error("[TYPE] Seek WhiteSpace, get [" + d + "]");
	// pass all WhiteSpaces
	while(!isWhiteSpace(d))
		d = decoder.raw[++i];

	return i;
}

function decodeStateComment(decoder, i) {
	var d = decoder.raw[i];
	if(d != CHAR["#"])
		throw new Error("[Comment] Seek [" + CHAR["#"] + "], get [" + d + "]");
	while(d != CHAR.CR && d != CHAR.LF)
		d = decoder.raw[++i];
	decoder.state = decoder.oldstate;
	return i;
}

function decodeStateWidth(decoder, i) {
	var d = decoder.raw[i];
	var w = "";
	while(!isWhiteSpace(d) && d != CHAR["#"]) {
		w += String.fromCharCode(d);
		d = decoder.raw[++i];
	}
	decoder.image.width = parseInt(w, 10);
	decoder.state = DECODER_STATE.HEIGHT;

	if(d == CHAR["#"]) {
		decoder.oldstate = decoder.state;
		decoder.state = DECODER_STATE.COMMENT;
		return --i;
	}

	return i;
}

function decodeStateHeight(decoder, i) {
	var d = decoder.raw[i];
	var h = "";
	while(!isWhiteSpace(d) && d != CHAR["#"]) {
		h += String.fromCharCode(d);
		d = decoder.raw[++i];
	}
	decoder.image.height = parseInt(h, 10);
	decoder.state = DECODER_STATE.MAXVAL;

	if(d == CHAR["#"]) {
		decoder.oldstate = decoder.state;
		decoder.state = DECODER_STATE.COMMENT;
		return --i;
	}

	return i;
}

function decodeStateMaxval(decoder, i) {
	var d = decoder.raw[i];
	var m = "";
	while(!isWhiteSpace(d) && d != CHAR["#"]) {
		m += String.fromCharCode(d);
		d = decoder.raw[++i];
	}
	decoder.image.maxval = parseInt(m, 10);
	decoder.twobits = decoder.image.maxval > 255;
	if(isWhiteSpace(decoder.raw[i+1])) {
		throw new Error("[Maxval] a single one whitespace is waiting for .ppm here");
	}
	decoder.state = DECODER_STATE.RGB;

	if(d == CHAR["#"]) {
		decoder.oldstate = decoder.state;
		decoder.state = DECODER_STATE.COMMENT;
		return --i;
	}

	return i;
}

function decodeStateRGBPlain(decoder, i) {
	var d = decoder.raw[i];
	var p = "";
	while(!isWhiteSpace(d) && d != CHAR["#"]) {
		p += String.fromCharCode(d);
		d = decoder.raw[++i];
	}
	decoder.image.buffer[decoder.image.index++] = to255(decoder.image.maxval, parseInt(p, 10));

	if(d == CHAR["#"]) {
		decoder.oldstate = decoder.state;
		decoder.state = DECODER_STATE.COMMENT;
		return --i;
	}

	return i;
}

function decodeStateRGBRaw(decoder, i) {
	var d = decoder.raw[i];
	decoder.image.buffer[decoder.image.index++] = to255(decoder.image.maxval, d);
	return i;
}

function isWhiteSpace(c) {
	return c == CHAR.SPACE || c == CHAR.CR || c == CHAR.LF
		|| c == CHAR.TAB || c == CHAR.FF || c == CHAR.VT;
}

function to255(max, x) {
	return x*255/max;
}

module.exports = PPMDecoder;
