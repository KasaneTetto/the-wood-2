// https://github.com/cemerick/jsdifflib

// Add code: https://github.com/cemerick/jsdifflib/pull/15
//  -> https://rawcdn.githack.com/wkpark/jsdifflib/dc19d085db5ae71cdff990aac8351607fee4fd01/difflib.js
//  -> https://rawcdn.githack.com/wkpark/jsdifflib/dc19d085db5ae71cdff990aac8351607fee4fd01/diffview.js

/***
This is part of jsdifflib v1.0. <http://github.com/cemerick/jsdifflib>

Copyright 2007 - 2011 Chas Emerick <cemerick@snowtide.com>. All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are
permitted provided that the following conditions are met:

   1. Redistributions of source code must retain the above copyright notice, this list of
      conditions and the following disclaimer.
	  
   2. Redistributions in binary form must reproduce the above copyright notice, this list
      of conditions and the following disclaimer in the documentation and/or other materials
      provided with the distribution.
	  
THIS SOFTWARE IS PROVIDED BY Chas Emerick ``AS IS'' AND ANY EXPRESS OR IMPLIED
WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL Chas Emerick OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation are those of the
authors and should not be interpreted as representing official policies, either expressed
or implied, of Chas Emerick.
***/
/* Author: Chas Emerick <cemerick@snowtide.com> */

// Code to run on Node.js
const jsdom = require('jsdom');
var JSDOM, document;
if(jsdom.JSDOM) {
	// JSDOM 신버전용 코드
	JSDOM = jsdom.JSDOM;
	document = (new JSDOM('<div></div>')).window.document;
} else {
	// JSDOM 9.12.0 버전용 코드
	document = jsdom.jsdom('<div></div>');
}

var __whitespace = {" ":true, "\t":true, "\n":true, "\f":true, "\r":true};

var difflib = {
	defaultJunkFunction: function (c) {
		return __whitespace.hasOwnProperty(c);
	},
	
	stripLinebreaks: function (str) { return str.replace(/^[\n\r]*|[\n\r]*$/g, ""); },
	
	stringAsLines: function (str) {
		var lfpos = str.indexOf("\n");
		var crpos = str.indexOf("\r");
		var linebreak = ((lfpos > -1 && crpos > -1) || crpos < 0) ? "\n" : "\r";

		if (str.substr(str.length - 1) != linebreak)
			str+= linebreak;
		var lines = str.split(linebreak);
		for (var i = 0; i < lines.length; i++) {
			lines[i] = difflib.stripLinebreaks(lines[i]);
		}
		
		return lines;
	},
	
	// iteration-based reduce implementation
	__reduce: function (func, list, initial) {
		if (initial != null) {
			var value = initial;
			var idx = 0;
		} else if (list) {
			var value = list[0];
			var idx = 1;
		} else {
			return null;
		}
		
		for (; idx < list.length; idx++) {
			value = func(value, list[idx]);
		}
		
		return value;
	},
	
	// comparison function for sorting lists of numeric tuples
	__ntuplecomp: function (a, b) {
		var mlen = Math.max(a.length, b.length);
		for (var i = 0; i < mlen; i++) {
			if (a[i] < b[i]) return -1;
			if (a[i] > b[i]) return 1;
		}
		
		return a.length == b.length ? 0 : (a.length < b.length ? -1 : 1);
	},
	
	__calculate_ratio: function (matches, length) {
		return length ? 2.0 * matches / length : 1.0;
	},
	
	// returns a function that returns true if a key passed to the returned function
	// is in the dict (js object) provided to this function; replaces being able to
	// carry around dict.has_key in python...
	__isindict: function (dict) {
		return function (key) { return dict.hasOwnProperty(key); };
	},
	
	// replacement for python's dict.get function -- need easy default values
	__dictget: function (dict, key, defaultValue) {
		return dict.hasOwnProperty(key) ? dict[key] : defaultValue;
	},	
	
	SequenceMatcher: function (a, b, isjunk) {
		this.set_seqs = function (a, b) {
			this.set_seq1(a);
			this.set_seq2(b);
		}
		
		this.set_seq1 = function (a) {
			if (a == this.a) return;
			this.a = a;
			this.matching_blocks = this.opcodes = null;
		}
		
		this.set_seq2 = function (b) {
			if (b == this.b) return;
			this.b = b;
			this.matching_blocks = this.opcodes = this.fullbcount = null;
			this.__chain_b();
		}
		
		this.__chain_b = function () {
			var b = this.b;
			var n = b.length;
			var b2j = this.b2j = {};
			var populardict = {};
			for (var i = 0; i < b.length; i++) {
				var elt = b[i];
				if (b2j.hasOwnProperty(elt)) {
					var indices = b2j[elt];
					if (n >= 200 && indices.length * 100 > n) {
						populardict[elt] = 1;
						delete b2j[elt];
					} else {
						indices.push(i);
					}
				} else {
					b2j[elt] = [i];
				}
			}
	
			for (var elt in populardict) {
				if (populardict.hasOwnProperty(elt)) {
					delete b2j[elt];
				}
			}
			
			var isjunk = this.isjunk;
			var junkdict = {};
			if (isjunk) {
				for (var elt in populardict) {
					if (populardict.hasOwnProperty(elt) && isjunk(elt)) {
						junkdict[elt] = 1;
						delete populardict[elt];
					}
				}
				for (var elt in b2j) {
					if (b2j.hasOwnProperty(elt) && isjunk(elt)) {
						junkdict[elt] = 1;
						delete b2j[elt];
					}
				}
			}
	
			this.isbjunk = difflib.__isindict(junkdict);
			this.isbpopular = difflib.__isindict(populardict);
		}
		
		this.find_longest_match = function (alo, ahi, blo, bhi) {
			var a = this.a;
			var b = this.b;
			var b2j = this.b2j;
			var isbjunk = this.isbjunk;
			var besti = alo;
			var bestj = blo;
			var bestsize = 0;
			var j = null;
			var k;
	
			var j2len = {};
			var nothing = [];
			for (var i = alo; i < ahi; i++) {
				var newj2len = {};
				var jdict = difflib.__dictget(b2j, a[i], nothing);
				for (var jkey in jdict) {
					if (jdict.hasOwnProperty(jkey)) {
						j = jdict[jkey];
						if (j < blo) continue;
						if (j >= bhi) break;
						newj2len[j] = k = difflib.__dictget(j2len, j - 1, 0) + 1;
						if (k > bestsize) {
							besti = i - k + 1;
							bestj = j - k + 1;
							bestsize = k;
						}
					}
				}
				j2len = newj2len;
			}
	
			while (besti > alo && bestj > blo && !isbjunk(b[bestj - 1]) && a[besti - 1] == b[bestj - 1]) {
				besti--;
				bestj--;
				bestsize++;
			}
				
			while (besti + bestsize < ahi && bestj + bestsize < bhi &&
					!isbjunk(b[bestj + bestsize]) &&
					a[besti + bestsize] == b[bestj + bestsize]) {
				bestsize++;
			}
	
			while (besti > alo && bestj > blo && isbjunk(b[bestj - 1]) && a[besti - 1] == b[bestj - 1]) {
				besti--;
				bestj--;
				bestsize++;
			}
			
			while (besti + bestsize < ahi && bestj + bestsize < bhi && isbjunk(b[bestj + bestsize]) &&
					a[besti + bestsize] == b[bestj + bestsize]) {
				bestsize++;
			}
	
			return [besti, bestj, bestsize];
		}
		
		this.get_matching_blocks = function () {
			if (this.matching_blocks != null) return this.matching_blocks;
			var la = this.a.length;
			var lb = this.b.length;
	
			var queue = [[0, la, 0, lb]];
			var matching_blocks = [];
			var alo, ahi, blo, bhi, qi, i, j, k, x;
			while (queue.length) {
				qi = queue.pop();
				alo = qi[0];
				ahi = qi[1];
				blo = qi[2];
				bhi = qi[3];
				x = this.find_longest_match(alo, ahi, blo, bhi);
				i = x[0];
				j = x[1];
				k = x[2];
	
				if (k) {
					matching_blocks.push(x);
					if (alo < i && blo < j)
						queue.push([alo, i, blo, j]);
					if (i+k < ahi && j+k < bhi)
						queue.push([i + k, ahi, j + k, bhi]);
				}
			}
			
			matching_blocks.sort(difflib.__ntuplecomp);
	
			var i1 = 0, j1 = 0, k1 = 0, block = 0;
			var i2, j2, k2;
			var non_adjacent = [];
			for (var idx in matching_blocks) {
				if (matching_blocks.hasOwnProperty(idx)) {
					block = matching_blocks[idx];
					i2 = block[0];
					j2 = block[1];
					k2 = block[2];
					if (i1 + k1 == i2 && j1 + k1 == j2) {
						k1 += k2;
					} else {
						if (k1) non_adjacent.push([i1, j1, k1]);
						i1 = i2;
						j1 = j2;
						k1 = k2;
					}
				}
			}
			
			if (k1) non_adjacent.push([i1, j1, k1]);
	
			non_adjacent.push([la, lb, 0]);
			this.matching_blocks = non_adjacent;
			return this.matching_blocks;
		}
		
		this.get_opcodes = function () {
			if (this.opcodes != null) return this.opcodes;
			var i = 0;
			var j = 0;
			var answer = [];
			this.opcodes = answer;
			var block, ai, bj, size, tag;
			var blocks = this.get_matching_blocks();
			for (var idx in blocks) {
				if (blocks.hasOwnProperty(idx)) {
					block = blocks[idx];
					ai = block[0];
					bj = block[1];
					size = block[2];
					tag = '';
					if (i < ai && j < bj) {
						tag = 'replace';
					} else if (i < ai) {
						tag = 'delete';
					} else if (j < bj) {
						tag = 'insert';
					}
					if (tag) answer.push([tag, i, ai, j, bj]);
					i = ai + size;
					j = bj + size;
					
					if (size) answer.push(['equal', ai, i, bj, j]);
				}
			}
			
			return answer;
		}
		
		// this is a generator function in the python lib, which of course is not supported in javascript
		// the reimplementation builds up the grouped opcodes into a list in their entirety and returns that.
		this.get_grouped_opcodes = function (n) {
			if (!n) n = 3;
			var codes = this.get_opcodes();
			if (!codes) codes = [["equal", 0, 1, 0, 1]];
			var code, tag, i1, i2, j1, j2;
			if (codes[0][0] == 'equal') {
				code = codes[0];
				tag = code[0];
				i1 = code[1];
				i2 = code[2];
				j1 = code[3];
				j2 = code[4];
				codes[0] = [tag, Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2];
			}
			if (codes[codes.length - 1][0] == 'equal') {
				code = codes[codes.length - 1];
				tag = code[0];
				i1 = code[1];
				i2 = code[2];
				j1 = code[3];
				j2 = code[4];
				codes[codes.length - 1] = [tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)];
			}
	
			var nn = n + n;
			var group = [];
			var groups = [];
			for (var idx in codes) {
				if (codes.hasOwnProperty(idx)) {
					code = codes[idx];
					tag = code[0];
					i1 = code[1];
					i2 = code[2];
					j1 = code[3];
					j2 = code[4];
					if (tag == 'equal' && i2 - i1 > nn) {
						group.push([tag, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]);
						groups.push(group);
						group = [];
						i1 = Math.max(i1, i2-n);
						j1 = Math.max(j1, j2-n);
					}
					
					group.push([tag, i1, i2, j1, j2]);
				}
			}
			
			if (group && !(group.length == 1 && group[0][0] == 'equal')) groups.push(group)
			
			return groups;
		}
		
		this.ratio = function () {
			matches = difflib.__reduce(
							function (sum, triple) { return sum + triple[triple.length - 1]; },
							this.get_matching_blocks(), 0);
			return difflib.__calculate_ratio(matches, this.a.length + this.b.length);
		}
		
		this.quick_ratio = function () {
			var fullbcount, elt;
			if (this.fullbcount == null) {
				this.fullbcount = fullbcount = {};
				for (var i = 0; i < this.b.length; i++) {
					elt = this.b[i];
					fullbcount[elt] = difflib.__dictget(fullbcount, elt, 0) + 1;
				}
			}
			fullbcount = this.fullbcount;
	
			var avail = {};
			var availhas = difflib.__isindict(avail);
			var matches = numb = 0;
			for (var i = 0; i < this.a.length; i++) {
				elt = this.a[i];
				if (availhas(elt)) {
					numb = avail[elt];
				} else {
					numb = difflib.__dictget(fullbcount, elt, 0);
				}
				avail[elt] = numb - 1;
				if (numb > 0) matches++;
			}
			
			return difflib.__calculate_ratio(matches, this.a.length + this.b.length);
		}
		
		this.real_quick_ratio = function () {
			var la = this.a.length;
			var lb = this.b.length;
			return _calculate_ratio(Math.min(la, lb), la + lb);
		}
		
		this.isjunk = isjunk ? isjunk : difflib.defaultJunkFunction;
		this.a = this.b = null;
		this.set_seqs(a, b);
	}
};

diffview = {
	/**
	 * Builds and returns a visual diff view.  The single parameter, `params', should contain
	 * the following values:
	 *
	 * - baseTextLines: the array of strings that was used as the base text input to SequenceMatcher
	 * - newTextLines: the array of strings that was used as the new text input to SequenceMatcher
	 * - opcodes: the array of arrays returned by SequenceMatcher.get_opcodes()
	 * - baseTextName: the title to be displayed above the base text listing in the diff view; defaults
	 *	   to "Base Text"
	 * - newTextName: the title to be displayed above the new text listing in the diff view; defaults
	 *	   to "New Text"
	 * - contextSize: the number of lines of context to show around differences; by default, all lines
	 *	   are shown
	 * - viewType: if 0, a side-by-side diff view is generated (default); if 1, an inline diff view is
	 *	   generated
	 */
	buildView: function (params) {
		var baseTextLines = params.baseTextLines;
		var newTextLines = params.newTextLines;
		var opcodes = params.opcodes;
		var baseTextName = params.baseTextName ? params.baseTextName : "Base Text";
		var newTextName = params.newTextName ? params.newTextName : "New Text";
		var contextSize = params.contextSize;
		var inline = (params.viewType == 0 || params.viewType >= 1) ? params.viewType : 0;
		var wordlevel = params.viewType > 1;

		if (baseTextLines == null)
			throw "Cannot build diff view; baseTextLines is not defined.";
		if (newTextLines == null)
			throw "Cannot build diff view; newTextLines is not defined.";
		if (!opcodes)
			throw "Canno build diff view; opcodes is not defined.";
		
		function celt (name, clazz) {
			var e = document.createElement(name);
			e.className = clazz;
			return e;
		}
		
		function telt (name, text) {
			var e = document.createElement(name);
			e.appendChild(document.createTextNode(text));
			return e;
		}
		
		function ctelt (name, clazz, text) {
			var e = document.createElement(name);
			e.className = clazz;
			e.appendChild(document.createTextNode(text));
			return e;
		}

		function ctel (name, clazz, node) {
			var e = document.createElement(name);
			e.className = clazz;
			e.appendChild(node);
			return e;
		}
	
		var tdata = document.createElement("thead");
		var node = document.createElement("tr");
		tdata.appendChild(node);
		if (inline) {
			node.appendChild(document.createElement("th"));
			node.appendChild(document.createElement("th"));
			node.appendChild(ctelt("th", "texttitle", baseTextName + " vs. " + newTextName));
		} else {
			node.appendChild(document.createElement("th"));
			node.appendChild(ctelt("th", "texttitle", baseTextName));
			node.appendChild(document.createElement("th"));
			node.appendChild(ctelt("th", "texttitle", newTextName));
		}
		tdata = [tdata];
		
		var rows = [];
		var node2;
		
		/**
		 * Adds two cells to the given row; if the given row corresponds to a real
		 * line number (based on the line index tidx and the endpoint of the 
		 * range in question tend), then the cells will contain the line number
		 * and the line of text from textLines at position tidx (with the class of
		 * the second cell set to the name of the change represented), and tidx + 1 will
		 * be returned.	 Otherwise, tidx is returned, and two empty cells are added
		 * to the given row.
		 */
		function addCells (row, tidx, tend, textLines, change) {
			if (tidx < tend) {
				row.appendChild(telt("th", (tidx + 1).toString()));
				row.appendChild(ctelt("td", change, textLines[tidx].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0")));
				return tidx + 1;
			} else {
				row.appendChild(document.createElement("th"));
				row.appendChild(celt("td", "empty"));
				return tidx;
			}
		}
		
		function addCellsInline (row, tidx, tidx2, textLines, change) {
			row.appendChild(telt("th", tidx == null ? "" : (tidx + 1).toString()));
			row.appendChild(telt("th", tidx2 == null ? "" : (tidx2 + 1).toString()));
			row.appendChild(ctelt("td", change, textLines[tidx != null ? tidx : tidx2].replace(/\t/g, "\u00a0\u00a0\u00a0\u00a0")));
		}

		function addCellsNode (row, tidx, tidx2, node, change) {
			row.appendChild(telt("th", tidx == null ? "" : (tidx + 1).toString()));
			row.appendChild(telt("th", tidx2 == null ? "" : (tidx2 + 1).toString()));
			row.appendChild(ctel("td", change, node));
		}

		for (var idx = 0; idx < opcodes.length; idx++) {
			code = opcodes[idx];
			change = code[0];
			var b = code[1];
			var be = code[2];
			var n = code[3];
			var ne = code[4];
			var rowcnt = Math.max(be - b, ne - n);
			var toprows = [];
			var botrows = [];
			for (var i = 0; i < rowcnt; i++) {
				// jump ahead if we've alredy provided leading context or if this is the first range
				if (contextSize && opcodes.length > 1 && ((idx > 0 && i == contextSize) || (idx == 0 && i == 0)) && change=="equal") {
					var jump = rowcnt - ((idx == 0 ? 1 : 2) * contextSize);
					if (jump > 1) {
						toprows.push(node = document.createElement("tr"));
						
						b += jump;
						n += jump;
						i += jump - 1;
						node.appendChild(telt("th", "..."));
						if (!inline) node.appendChild(ctelt("td", "skip", ""));
						node.appendChild(telt("th", "..."));
						node.appendChild(ctelt("td", "skip", ""));
						
						// skip last lines if they're all equal
						if (idx + 1 == opcodes.length) {
							break;
						} else {
							continue;
						}
					}
				}
				
				toprows.push(node = document.createElement("tr"));
				if (inline) {
					if (change == "insert") {
						addCellsInline(node, null, n++, newTextLines, change);
					} else if (change == "replace") {
						botrows.push(node2 = document.createElement("tr"));
						if (wordlevel) {
						var baseTextLine = baseTextLines[b];
						var newTextLine = newTextLines[n];
						if (!baseTextLine) baseTextLine = '';
						if (!newTextLine) newTextLine = '';
						var wordrule = /([^\S]+|[a-zA-Z0-9_-]+|[\uac00-\ud7af]+|.)(?:(?!<)[^\S\s])?/;
						var bw = baseTextLine.split(wordrule).filter(function(n) {return n;});
						var nw = newTextLine.split(wordrule).filter(function(n) {return n;});
						var wsm = new difflib.SequenceMatcher(bw, nw);
						var wopcodes = wsm.get_opcodes();
						var bnode = document.createElement('div');
						var nnode = document.createElement('div');
						for (var k = 0; k < wopcodes.length; k++) {
							var wcode = wopcodes[k];
							var wchange = wcode[0];
							var wb = wcode[1];
							var wbe = wcode[2];
							var wn = wcode[3];
							var wne = wcode[4];
							var wcnt = Math.max(wbe - wb, wne - wn);

							for (var m = 0; m < wcnt; m++) {
								if (wchange == "insert") {
									nnode.appendChild(ctelt("ins", "diff", nw[wn++]));
								} else if (wchange == "replace") {
									if (wb < wbe) bnode.appendChild(ctelt("del", "diff", bw[wb++]));
									if (wn < wne) nnode.appendChild(ctelt("ins", "diff", nw[wn++]));
								} else if (wchange == "delete") {
									bnode.appendChild(ctelt("del", "diff", bw[wb++]));
								} else {
									// equal
									bnode.appendChild(ctelt("span", wchange, bw[wb]));
									nnode.appendChild(ctelt("span", wchange, bw[wb++]));
								}
							}
						}
						if (b < be) addCellsNode(node, b++, null, bnode, "delete");
						if (n < ne) addCellsNode(node2, null, n++, nnode, "insert");
						} else {
						if (b < be) addCellsInline(node, b++, null, baseTextLines, "delete");
						if (n < ne) addCellsInline(node2, null, n++, newTextLines, "insert");
						}
					} else if (change == "delete") {
						addCellsInline(node, b++, null, baseTextLines, change);
					} else {
						// equal
						addCellsInline(node, b++, n++, baseTextLines, change);
					}
				} else {
					b = addCells(node, b, be, baseTextLines, change);
					n = addCells(node, n, ne, newTextLines, change);
				}
			}

			for (var i = 0; i < toprows.length; i++) rows.push(toprows[i]);
			for (var i = 0; i < botrows.length; i++) rows.push(botrows[i]);
		}
		
		rows.push(node = ctelt("th", "author", "diff view generated by "));
		node.setAttribute("colspan", inline ? 3 : 4);
		node.appendChild(node2 = telt("a", "jsdifflib"));
		node2.setAttribute("href", "http://github.com/cemerick/jsdifflib");
		
		tdata.push(node = document.createElement("tbody"));
		for (var idx in rows) rows.hasOwnProperty(idx) && node.appendChild(rows[idx]);
		
		node = celt("table", "diff" + (inline ? " inlinediff" : ""));
		for (var idx in tdata) tdata.hasOwnProperty(idx) && node.appendChild(tdata[idx]);
		return node;
	}
};

module.exports = function diff(base, newtext, bname = '원본', nname = '새 내용') {
	base    = difflib.stringAsLines(base.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
	newtext = difflib.stringAsLines(newtext.replace(/\r\n/g, '\n').replace(/\r/g, '\n'));
	
	const sm = new difflib.SequenceMatcher(base, newtext);
	const opcodes = sm.get_opcodes();
	
	return (diffview.buildView({
		baseTextLines: base,
		newTextLines: newtext,
		opcodes: opcodes,
		baseTextName: bname,
		newTextName: nname,
		contextSize: 7,
		viewType: 2,
	})).outerHTML;
};
