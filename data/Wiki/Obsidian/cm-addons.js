/**
 * addon/search/searchcursor.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"))
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod)
	else // Plain browser env
		mod(CodeMirror)
})(function(CodeMirror) {
	"use strict"
	var Pos = CodeMirror.Pos

	function regexpFlags(regexp) {
		var flags = regexp.flags
		return flags != null ? flags : (regexp.ignoreCase ? "i" : "")
			+ (regexp.global ? "g" : "")
			+ (regexp.multiline ? "m" : "")
	}

	function ensureFlags(regexp, flags) {
		var current = regexpFlags(regexp), target = current
		for (var i = 0; i < flags.length; i++) if (target.indexOf(flags.charAt(i)) == -1)
			target += flags.charAt(i)
		return current == target ? regexp : new RegExp(regexp.source, target)
	}

	function maybeMultiline(regexp) {
		return /\\s|\\n|\n|\\W|\\D|\[\^/.test(regexp.source)
	}

	function searchRegexpForward(doc, regexp, start) {
		regexp = ensureFlags(regexp, "g")
		for (var line = start.line, ch = start.ch, last = doc.lastLine(); line <= last; line++, ch = 0) {
			regexp.lastIndex = ch
			var string = doc.getLine(line), match = regexp.exec(string)
			if (match)
				return {from: Pos(line, match.index),
					to: Pos(line, match.index + match[0].length),
					match: match}
		}
	}

	function searchRegexpForwardMultiline(doc, regexp, start) {
		if (!maybeMultiline(regexp)) return searchRegexpForward(doc, regexp, start)

		regexp = ensureFlags(regexp, "gm")
		var string, chunk = 1
		for (var line = start.line, last = doc.lastLine(); line <= last;) {
			// This grows the search buffer in exponentially-sized chunks
			// between matches, so that nearby matches are fast and don't
			// require concatenating the whole document (in case we're
			// searching for something that has tons of matches), but at the
			// same time, the amount of retries is limited.
			for (var i = 0; i < chunk; i++) {
				if (line > last) break
				var curLine = doc.getLine(line++)
				string = string == null ? curLine : string + "\n" + curLine
			}
			chunk = chunk * 2
			regexp.lastIndex = start.ch
			var match = regexp.exec(string)
			if (match) {
				var before = string.slice(0, match.index).split("\n"), inside = match[0].split("\n")
				var startLine = start.line + before.length - 1, startCh = before[before.length - 1].length
				return {from: Pos(startLine, startCh),
					to: Pos(startLine + inside.length - 1,
						inside.length == 1 ? startCh + inside[0].length : inside[inside.length - 1].length),
					match: match}
			}
		}
	}

	function lastMatchIn(string, regexp, endMargin) {
		var match, from = 0
		while (from <= string.length) {
			regexp.lastIndex = from
			var newMatch = regexp.exec(string)
			if (!newMatch) break
			var end = newMatch.index + newMatch[0].length
			if (end > string.length - endMargin) break
			if (!match || end > match.index + match[0].length)
				match = newMatch
			from = newMatch.index + 1
		}
		return match
	}

	function searchRegexpBackward(doc, regexp, start) {
		regexp = ensureFlags(regexp, "g")
		for (var line = start.line, ch = start.ch, first = doc.firstLine(); line >= first; line--, ch = -1) {
			var string = doc.getLine(line)
			var match = lastMatchIn(string, regexp, ch < 0 ? 0 : string.length - ch)
			if (match)
				return {from: Pos(line, match.index),
					to: Pos(line, match.index + match[0].length),
					match: match}
		}
	}

	function searchRegexpBackwardMultiline(doc, regexp, start) {
		if (!maybeMultiline(regexp)) return searchRegexpBackward(doc, regexp, start)
		regexp = ensureFlags(regexp, "gm")
		var string, chunkSize = 1, endMargin = doc.getLine(start.line).length - start.ch
		for (var line = start.line, first = doc.firstLine(); line >= first;) {
			for (var i = 0; i < chunkSize && line >= first; i++) {
				var curLine = doc.getLine(line--)
				string = string == null ? curLine : curLine + "\n" + string
			}
			chunkSize *= 2

			var match = lastMatchIn(string, regexp, endMargin)
			if (match) {
				var before = string.slice(0, match.index).split("\n"), inside = match[0].split("\n")
				var startLine = line + before.length, startCh = before[before.length - 1].length
				return {from: Pos(startLine, startCh),
					to: Pos(startLine + inside.length - 1,
						inside.length == 1 ? startCh + inside[0].length : inside[inside.length - 1].length),
					match: match}
			}
		}
	}

	var doFold, noFold
	if (String.prototype.normalize) {
		doFold = function(str) { return str.normalize("NFD").toLowerCase() }
		noFold = function(str) { return str.normalize("NFD") }
	} else {
		doFold = function(str) { return str.toLowerCase() }
		noFold = function(str) { return str }
	}

	// Maps a position in a case-folded line back to a position in the original line
	// (compensating for codepoints increasing in number during folding)
	function adjustPos(orig, folded, pos, foldFunc) {
		if (orig.length == folded.length) return pos
		for (var min = 0, max = pos + Math.max(0, orig.length - folded.length);;) {
			if (min == max) return min
			var mid = (min + max) >> 1
			var len = foldFunc(orig.slice(0, mid)).length
			if (len == pos) return mid
			else if (len > pos) max = mid
			else min = mid + 1
		}
	}

	function searchStringForward(doc, query, start, caseFold) {
		// Empty string would match anything and never progress, so we
		// define it to match nothing instead.
		if (!query.length) return null
		var fold = caseFold ? doFold : noFold
		var lines = fold(query).split(/\r|\n\r?/)

		search: for (var line = start.line, ch = start.ch, last = doc.lastLine() + 1 - lines.length; line <= last; line++, ch = 0) {
			var orig = doc.getLine(line).slice(ch), string = fold(orig)
			if (lines.length == 1) {
				var found = string.indexOf(lines[0])
				if (found == -1) continue search
				var start = adjustPos(orig, string, found, fold) + ch
				return {from: Pos(line, adjustPos(orig, string, found, fold) + ch),
					to: Pos(line, adjustPos(orig, string, found + lines[0].length, fold) + ch)}
			} else {
				var cutFrom = string.length - lines[0].length
				if (string.slice(cutFrom) != lines[0]) continue search
				for (var i = 1; i < lines.length - 1; i++)
					if (fold(doc.getLine(line + i)) != lines[i]) continue search
				var end = doc.getLine(line + lines.length - 1), endString = fold(end), lastLine = lines[lines.length - 1]
				if (endString.slice(0, lastLine.length) != lastLine) continue search
				return {from: Pos(line, adjustPos(orig, string, cutFrom, fold) + ch),
					to: Pos(line + lines.length - 1, adjustPos(end, endString, lastLine.length, fold))}
			}
		}
	}

	function searchStringBackward(doc, query, start, caseFold) {
		if (!query.length) return null
		var fold = caseFold ? doFold : noFold
		var lines = fold(query).split(/\r|\n\r?/)

		search: for (var line = start.line, ch = start.ch, first = doc.firstLine() - 1 + lines.length; line >= first; line--, ch = -1) {
			var orig = doc.getLine(line)
			if (ch > -1) orig = orig.slice(0, ch)
			var string = fold(orig)
			if (lines.length == 1) {
				var found = string.lastIndexOf(lines[0])
				if (found == -1) continue search
				return {from: Pos(line, adjustPos(orig, string, found, fold)),
					to: Pos(line, adjustPos(orig, string, found + lines[0].length, fold))}
			} else {
				var lastLine = lines[lines.length - 1]
				if (string.slice(0, lastLine.length) != lastLine) continue search
				for (var i = 1, start = line - lines.length + 1; i < lines.length - 1; i++)
					if (fold(doc.getLine(start + i)) != lines[i]) continue search
				var top = doc.getLine(line + 1 - lines.length), topString = fold(top)
				if (topString.slice(topString.length - lines[0].length) != lines[0]) continue search
				return {from: Pos(line + 1 - lines.length, adjustPos(top, topString, top.length - lines[0].length, fold)),
					to: Pos(line, adjustPos(orig, string, lastLine.length, fold))}
			}
		}
	}

	function SearchCursor(doc, query, pos, options) {
		this.atOccurrence = false
		this.doc = doc
		pos = pos ? doc.clipPos(pos) : Pos(0, 0)
		this.pos = {from: pos, to: pos}

		var caseFold
		if (typeof options == "object") {
			caseFold = options.caseFold
		} else { // Backwards compat for when caseFold was the 4th argument
			caseFold = options
			options = null
		}

		if (typeof query == "string") {
			if (caseFold == null) caseFold = false
			this.matches = function(reverse, pos) {
				return (reverse ? searchStringBackward : searchStringForward)(doc, query, pos, caseFold)
			}
		} else {
			query = ensureFlags(query, "gm")
			if (!options || options.multiline !== false)
				this.matches = function(reverse, pos) {
					return (reverse ? searchRegexpBackwardMultiline : searchRegexpForwardMultiline)(doc, query, pos)
				}
			else
				this.matches = function(reverse, pos) {
					return (reverse ? searchRegexpBackward : searchRegexpForward)(doc, query, pos)
				}
		}
	}

	SearchCursor.prototype = {
		findNext: function() {return this.find(false)},
		findPrevious: function() {return this.find(true)},

		find: function(reverse) {
			var result = this.matches(reverse, this.doc.clipPos(reverse ? this.pos.from : this.pos.to))

			// Implements weird auto-growing behavior on null-matches for
			// backwards-compatibility with the vim code (unfortunately)
			while (result && CodeMirror.cmpPos(result.from, result.to) == 0) {
				if (reverse) {
					if (result.from.ch) result.from = Pos(result.from.line, result.from.ch - 1)
					else if (result.from.line == this.doc.firstLine()) result = null
					else result = this.matches(reverse, this.doc.clipPos(Pos(result.from.line - 1)))
				} else {
					if (result.to.ch < this.doc.getLine(result.to.line).length) result.to = Pos(result.to.line, result.to.ch + 1)
					else if (result.to.line == this.doc.lastLine()) result = null
					else result = this.matches(reverse, Pos(result.to.line + 1, 0))
				}
			}

			if (result) {
				this.pos = result
				this.atOccurrence = true
				return this.pos.match || true
			} else {
				var end = Pos(reverse ? this.doc.firstLine() : this.doc.lastLine() + 1, 0)
				this.pos = {from: end, to: end}
				return this.atOccurrence = false
			}
		},

		from: function() {if (this.atOccurrence) return this.pos.from},
		to: function() {if (this.atOccurrence) return this.pos.to},

		replace: function(newText, origin) {
			if (!this.atOccurrence) return
			var lines = CodeMirror.splitLines(newText)
			this.doc.replaceRange(lines, this.pos.from, this.pos.to, origin)
			this.pos.to = Pos(this.pos.from.line + lines.length - 1,
				lines[lines.length - 1].length + (lines.length == 1 ? this.pos.from.ch : 0))
		}
	}

	CodeMirror.defineExtension("getSearchCursor", function(query, pos, caseFold) {
		return new SearchCursor(this.doc, query, pos, caseFold)
	})
	CodeMirror.defineDocExtension("getSearchCursor", function(query, pos, caseFold) {
		return new SearchCursor(this, query, pos, caseFold)
	})

	CodeMirror.defineExtension("selectMatches", function(query, caseFold) {
		var ranges = []
		var cur = this.getSearchCursor(query, this.getCursor("from"), caseFold)
		while (cur.findNext()) {
			if (CodeMirror.cmpPos(cur.to(), this.getCursor("to")) > 0) break
			ranges.push({anchor: cur.from(), head: cur.to()})
		}
		if (ranges.length)
			this.setSelections(ranges, 0)
	})
});

/**
 * Modified from addon/edit/closebrackets.js to add surroundOnly.
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	var defaults = {
		pairs: "()[]{}''\"\"",
		closeBefore: ")]}'\":;>",
		triples: "",
		explode: "[]{}",
		surroundOnly: "",
	};

	var Pos = CodeMirror.Pos;

	CodeMirror.defineOption("autoCloseBrackets", false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			cm.removeKeyMap(keyMap);
			cm.state.closeBrackets = null;
		}
		if (val) {
			ensureBound(getOption(val, "pairs"))
			cm.state.closeBrackets = val;
			cm.addKeyMap(keyMap);
		}
	});

	function getOption(conf, name) {
		if (name == "pairs" && typeof conf == "string") return conf;
		if (typeof conf == "object" && conf[name] != null) return conf[name];
		return defaults[name];
	}

	var keyMap = {Backspace: handleBackspace, Enter: handleEnter};
	function ensureBound(chars) {
		for (var i = 0; i < chars.length; i++) {
			var ch = chars.charAt(i), key = "'" + ch + "'"
			if (!keyMap[key]) keyMap[key] = handler(ch)
		}
	}
	ensureBound(defaults.pairs + "`")

	function handler(ch) {
		return function(cm) { return handleChar(cm, ch); };
	}

	function getConfig(cm) {
		var deflt = cm.state.closeBrackets;
		if (!deflt || deflt.override) return deflt;
		var mode = cm.getModeAt(cm.getCursor());
		return mode.closeBrackets || deflt;
	}

	function handleBackspace(cm) {
		var conf = getConfig(cm);
		if (!conf || cm.getOption("disableInput")) return CodeMirror.Pass;

		var pairs = getOption(conf, "pairs");
		var ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			if (!ranges[i].empty()) return CodeMirror.Pass;
			var around = charsAround(cm, ranges[i].head);
			if (!around || pairs.indexOf(around) % 2 != 0) return CodeMirror.Pass;
		}
		for (var i = ranges.length - 1; i >= 0; i--) {
			var cur = ranges[i].head;
			cm.replaceRange("", Pos(cur.line, cur.ch - 1), Pos(cur.line, cur.ch + 1), "+delete");
		}
	}

	function handleEnter(cm) {
		var conf = getConfig(cm);
		var explode = conf && getOption(conf, "explode");
		if (!explode || cm.getOption("disableInput")) return CodeMirror.Pass;

		var ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			if (!ranges[i].empty()) return CodeMirror.Pass;
			var around = charsAround(cm, ranges[i].head);
			if (!around || explode.indexOf(around) % 2 != 0) return CodeMirror.Pass;
		}
		cm.operation(function() {
			var linesep = cm.lineSeparator() || "\n";
			cm.replaceSelection(linesep + linesep, null);
			moveSel(cm, -1)
			ranges = cm.listSelections();
			for (var i = 0; i < ranges.length; i++) {
				var line = ranges[i].head.line;
				cm.indentLine(line, null, true);
				cm.indentLine(line + 1, null, true);
			}
		});
	}

	function moveSel(cm, dir) {
		var newRanges = [], ranges = cm.listSelections(), primary = 0
		for (var i = 0; i < ranges.length; i++) {
			var range = ranges[i]
			if (range.head == cm.getCursor()) primary = i
			var pos = range.head.ch || dir > 0 ? {line: range.head.line, ch: range.head.ch + dir} : {line: range.head.line - 1}
			newRanges.push({anchor: pos, head: pos})
		}
		cm.setSelections(newRanges, primary)
	}

	function contractSelection(sel) {
		var inverted = CodeMirror.cmpPos(sel.anchor, sel.head) > 0;
		return {anchor: new Pos(sel.anchor.line, sel.anchor.ch + (inverted ? -1 : 1)),
			head: new Pos(sel.head.line, sel.head.ch + (inverted ? 1 : -1))};
	}

	function handleChar(cm, ch) {
		var conf = getConfig(cm);
		if (!conf || cm.getOption("disableInput")) return CodeMirror.Pass;

		var pairs = getOption(conf, "pairs");
		var pos = pairs.indexOf(ch);
		if (pos == -1) return CodeMirror.Pass;

		var closeBefore = getOption(conf,"closeBefore");

		var triples = getOption(conf, "triples");
		var surroundOnly = getOption(conf, "surroundOnly");

		var identical = pairs.charAt(pos + 1) == ch;
		var ranges = cm.listSelections();
		var opening = pos % 2 == 0;

		var type;
		for (var i = 0; i < ranges.length; i++) {
			var range = ranges[i], cur = range.head, curType;
			var next = cm.getRange(cur, Pos(cur.line, cur.ch + 1));
			if (opening && !range.empty()) {
				curType = "surround";
			} else if ((identical || !opening) && next == ch) {
				if (identical && stringStartsAfter(cm, cur))
					curType = "both";
				else if (triples.indexOf(ch) >= 0 && cm.getRange(cur, Pos(cur.line, cur.ch + 3)) == ch + ch + ch)
					curType = "skipThree";
				else
					curType = "skip";
			} else if (identical && cur.ch > 1 && triples.indexOf(ch) >= 0 &&
				cm.getRange(Pos(cur.line, cur.ch - 2), cur) == ch + ch) {
				if (cur.ch > 2 && /\bstring/.test(cm.getTokenTypeAt(Pos(cur.line, cur.ch - 2)))) return CodeMirror.Pass;
				curType = "addFour";
			} else if (identical) {
				var prev = cur.ch == 0 ? " " : cm.getRange(Pos(cur.line, cur.ch - 1), cur)
				if (!CodeMirror.isWordChar(next) && prev != ch && !CodeMirror.isWordChar(prev)) curType = "both";
				else return CodeMirror.Pass;
			} else if (opening && (next.length === 0 || /\s/.test(next) || closeBefore.indexOf(next) > -1)) {
				curType = "both";
			} else {
				return CodeMirror.Pass;
			}
			if (!type) type = curType;
			else if (type != curType) return CodeMirror.Pass;
		}

		if (curType !== "surround" && surroundOnly.indexOf(ch) >= 0) return CodeMirror.Pass;

		var left = pos % 2 ? pairs.charAt(pos - 1) : ch;
		var right = pos % 2 ? ch : pairs.charAt(pos + 1);
		cm.operation(function() {
			if (type == "skip") {
				moveSel(cm, 1)
			} else if (type == "skipThree") {
				moveSel(cm, 3)
			} else if (type == "surround") {
				var sels = cm.getSelections();
				for (var i = 0; i < sels.length; i++)
					sels[i] = left + sels[i] + right;
				cm.replaceSelections(sels, "around");
				sels = cm.listSelections().slice();
				for (var i = 0; i < sels.length; i++)
					sels[i] = contractSelection(sels[i]);
				cm.setSelections(sels);
			} else if (type == "both") {
				cm.replaceSelection(left + right, null);
				cm.triggerElectric(left + right);
				moveSel(cm, -1)
			} else if (type == "addFour") {
				cm.replaceSelection(left + left + left + left, "before");
				moveSel(cm, 1)
			}
		});
	}

	function charsAround(cm, pos) {
		var str = cm.getRange(Pos(pos.line, pos.ch - 1),
			Pos(pos.line, pos.ch + 1));
		return str.length == 2 ? str : null;
	}

	function stringStartsAfter(cm, pos) {
		var token = cm.getTokenAt(Pos(pos.line, pos.ch + 1))
		return /\bstring/.test(token.type) && token.start == pos.ch &&
			(pos.ch == 0 || !/\bstring/.test(cm.getTokenTypeAt(pos)))
	}
});

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	var ie_lt8 = /MSIE \d/.test(navigator.userAgent) &&
		(document.documentMode == null || document.documentMode < 8);

	var Pos = CodeMirror.Pos;

	var matching = {"(": ")>", ")": "(<", "[": "]>", "]": "[<", "{": "}>", "}": "{<", "<": ">>", ">": "<<"};

	function bracketRegex(config) {
		return config && config.bracketRegex || /[(){}[\]]/
	}

	function findMatchingBracket(cm, where, config) {
		var line = cm.getLineHandle(where.line), pos = where.ch - 1;
		var afterCursor = config && config.afterCursor
		if (afterCursor == null)
			afterCursor = /(^| )cm-fat-cursor($| )/.test(cm.getWrapperElement().className)
		var re = bracketRegex(config)

		// A cursor is defined as between two characters, but in in vim command mode
		// (i.e. not insert mode), the cursor is visually represented as a
		// highlighted box on top of the 2nd character. Otherwise, we allow matches
		// from before or after the cursor.
		var match = (!afterCursor && pos >= 0 && re.test(line.text.charAt(pos)) && matching[line.text.charAt(pos)]) ||
			re.test(line.text.charAt(pos + 1)) && matching[line.text.charAt(++pos)];
		if (!match) return null;
		var dir = match.charAt(1) == ">" ? 1 : -1;
		if (config && config.strict && (dir > 0) != (pos == where.ch)) return null;
		var style = cm.getTokenTypeAt(Pos(where.line, pos + 1));

		var found = scanForBracket(cm, Pos(where.line, pos + (dir > 0 ? 1 : 0)), dir, style, config);
		if (found == null) return null;
		return {from: Pos(where.line, pos), to: found && found.pos,
			match: found && found.ch == match.charAt(0), forward: dir > 0};
	}

	// bracketRegex is used to specify which type of bracket to scan
	// should be a regexp, e.g. /[[\]]/
	//
	// Note: If "where" is on an open bracket, then this bracket is ignored.
	//
	// Returns false when no bracket was found, null when it reached
	// maxScanLines and gave up
	function scanForBracket(cm, where, dir, style, config) {
		var maxScanLen = (config && config.maxScanLineLength) || 10000;
		var maxScanLines = (config && config.maxScanLines) || 1000;

		var stack = [];
		var re = bracketRegex(config)
		var lineEnd = dir > 0 ? Math.min(where.line + maxScanLines, cm.lastLine() + 1)
			: Math.max(cm.firstLine() - 1, where.line - maxScanLines);
		for (var lineNo = where.line; lineNo != lineEnd; lineNo += dir) {
			var line = cm.getLine(lineNo);
			if (!line) continue;
			var pos = dir > 0 ? 0 : line.length - 1, end = dir > 0 ? line.length : -1;
			if (line.length > maxScanLen) continue;
			if (lineNo == where.line) pos = where.ch - (dir < 0 ? 1 : 0);
			for (; pos != end; pos += dir) {
				var ch = line.charAt(pos);
				if (re.test(ch) && (style === undefined ||
					(cm.getTokenTypeAt(Pos(lineNo, pos + 1)) || "") == (style || ""))) {
					var match = matching[ch];
					if (match && (match.charAt(1) == ">") == (dir > 0)) stack.push(ch);
					else if (!stack.length) return {pos: Pos(lineNo, pos), ch: ch};
					else stack.pop();
				}
			}
		}
		return lineNo - dir == (dir > 0 ? cm.lastLine() : cm.firstLine()) ? false : null;
	}

	function matchBrackets(cm, autoclear, config) {
		// Disable brace matching in long lines, since it'll cause hugely slow updates
		var maxHighlightLen = cm.state.matchBrackets.maxHighlightLineLength || 1000,
			highlightNonMatching = config && config.highlightNonMatching;
		var marks = [], ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			var match = ranges[i].empty() && findMatchingBracket(cm, ranges[i].head, config);
			if (match && (match.match || highlightNonMatching !== false) && cm.getLine(match.from.line).length <= maxHighlightLen) {
				var style = match.match ? "CodeMirror-matchingbracket" : "CodeMirror-nonmatchingbracket";
				marks.push(cm.markText(match.from, Pos(match.from.line, match.from.ch + 1), {className: style}));
				if (match.to && cm.getLine(match.to.line).length <= maxHighlightLen)
					marks.push(cm.markText(match.to, Pos(match.to.line, match.to.ch + 1), {className: style}));
			}
		}

		if (marks.length) {
			// Kludge to work around the IE bug from issue #1193, where text
			// input stops going to the textarea whenever this fires.
			if (ie_lt8 && cm.state.focused) cm.focus();

			var clear = function() {
				cm.operation(function() {
					for (var i = 0; i < marks.length; i++) marks[i].clear();
				});
			};
			if (autoclear) setTimeout(clear, 800);
			else return clear;
		}
	}

	function doMatchBrackets(cm) {
		cm.operation(function() {
			if (cm.state.matchBrackets.currentlyHighlighted) {
				cm.state.matchBrackets.currentlyHighlighted();
				cm.state.matchBrackets.currentlyHighlighted = null;
			}
			cm.state.matchBrackets.currentlyHighlighted = matchBrackets(cm, false, cm.state.matchBrackets);
		});
	}

	function clearHighlighted(cm) {
		if (cm.state.matchBrackets && cm.state.matchBrackets.currentlyHighlighted) {
			cm.state.matchBrackets.currentlyHighlighted();
			cm.state.matchBrackets.currentlyHighlighted = null;
		}
	}

	CodeMirror.defineOption("matchBrackets", false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			cm.off("cursorActivity", doMatchBrackets);
			cm.off("focus", doMatchBrackets)
			cm.off("blur", clearHighlighted)
			clearHighlighted(cm);
		}
		if (val) {
			cm.state.matchBrackets = typeof val == "object" ? val : {};
			cm.on("cursorActivity", doMatchBrackets);
			cm.on("focus", doMatchBrackets)
			cm.on("blur", clearHighlighted)
		}
	});

	CodeMirror.defineExtension("matchBrackets", function() {matchBrackets(this, true);});
	CodeMirror.defineExtension("findMatchingBracket", function(pos, config, oldConfig){
		// Backwards-compatibility kludge
		if (oldConfig || typeof config == "boolean") {
			if (!oldConfig) {
				config = config ? {strict: true} : null
			} else {
				oldConfig.strict = config
				config = oldConfig
			}
		}
		return findMatchingBracket(this, pos, config)
	});
	CodeMirror.defineExtension("scanForBracket", function(pos, dir, style, config){
		return scanForBracket(this, pos, dir, style, config);
	});
});

/**
 * addon/fold/foldcode.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	function doFold(cm, pos, options, force) {
		if (options && options.call) {
			var finder = options;
			options = null;
		} else {
			var finder = getOption(cm, options, "rangeFinder");
		}
		if (typeof pos == "number") pos = CodeMirror.Pos(pos, 0);
		var minSize = getOption(cm, options, "minFoldSize");

		function getRange(allowFolded) {
			var range = finder(cm, pos);
			if (!range || range.to.line - range.from.line < minSize) return null;
			var marks = cm.findMarksAt(range.from);
			for (var i = 0; i < marks.length; ++i) {
				if (marks[i].__isFold && force !== "fold") {
					if (!allowFolded) return null;
					range.cleared = true;
					marks[i].clear();
				}
			}
			return range;
		}

		var range = getRange(true);
		if (getOption(cm, options, "scanUp")) while (!range && pos.line > cm.firstLine()) {
			pos = CodeMirror.Pos(pos.line - 1, 0);
			range = getRange(false);
		}
		if (!range || range.cleared || force === "unfold") return;

		var myWidget = makeWidget(cm, options, range);
		CodeMirror.on(myWidget, "mousedown", function(e) {
			myRange.clear();
			CodeMirror.e_preventDefault(e);
		});
		var myRange = cm.markText(range.from, range.to, {
			replacedWith: myWidget,
			clearOnEnter: getOption(cm, options, "clearOnEnter"),
			__isFold: true
		});
		myRange.on("clear", function(from, to) {
			CodeMirror.signal(cm, "unfold", cm, from, to);
		});
		CodeMirror.signal(cm, "fold", cm, range.from, range.to);
	}

	function makeWidget(cm, options, range) {
		var widget = getOption(cm, options, "widget");

		if (typeof widget == "function") {
			widget = widget(range.from, range.to);
		}

		if (typeof widget == "string") {
			var text = document.createTextNode(widget);
			widget = document.createElement("span");
			widget.appendChild(text);
			widget.className = "CodeMirror-foldmarker";
		} else if (widget) {
			widget = widget.cloneNode(true)
		}
		return widget;
	}

	// Clumsy backwards-compatible interface
	CodeMirror.newFoldFunction = function(rangeFinder, widget) {
		return function(cm, pos) { doFold(cm, pos, {rangeFinder: rangeFinder, widget: widget}); };
	};

	// New-style interface
	CodeMirror.defineExtension("foldCode", function(pos, options, force) {
		doFold(this, pos, options, force);
	});

	CodeMirror.defineExtension("isFolded", function(pos) {
		var marks = this.findMarksAt(pos);
		for (var i = 0; i < marks.length; ++i)
			if (marks[i].__isFold) return true;
	});

	CodeMirror.commands.toggleFold = function(cm) {
		cm.foldCode(cm.getCursor());
	};
	CodeMirror.commands.fold = function(cm) {
		cm.foldCode(cm.getCursor(), null, "fold");
	};
	CodeMirror.commands.unfold = function(cm) {
		cm.foldCode(cm.getCursor(), null, "unfold");
	};
	CodeMirror.commands.foldAll = function(cm) {
		cm.operation(function() {
			for (var i = cm.firstLine(), e = cm.lastLine(); i <= e; i++)
				cm.foldCode(CodeMirror.Pos(i, 0), null, "fold");
		});
	};
	CodeMirror.commands.unfoldAll = function(cm) {
		cm.operation(function() {
			for (var i = cm.firstLine(), e = cm.lastLine(); i <= e; i++)
				cm.foldCode(CodeMirror.Pos(i, 0), null, "unfold");
		});
	};

	CodeMirror.registerHelper("fold", "combine", function() {
		var funcs = Array.prototype.slice.call(arguments, 0);
		return function(cm, start) {
			for (var i = 0; i < funcs.length; ++i) {
				var found = funcs[i](cm, start);
				if (found) return found;
			}
		};
	});

	CodeMirror.registerHelper("fold", "auto", function(cm, start) {
		var helpers = cm.getHelpers(start, "fold");
		for (var i = 0; i < helpers.length; i++) {
			var cur = helpers[i](cm, start);
			if (cur) return cur;
		}
	});

	var defaultOptions = {
		rangeFinder: CodeMirror.fold.auto,
		widget: "...",
		minFoldSize: 0,
		scanUp: false,
		clearOnEnter: true
	};

	CodeMirror.defineOption("foldOptions", null);

	function getOption(cm, options, name) {
		if (options && options[name] !== undefined)
			return options[name];
		var editorOptions = cm.options.foldOptions;
		if (editorOptions && editorOptions[name] !== undefined)
			return editorOptions[name];
		return defaultOptions[name];
	}

	CodeMirror.defineExtension("foldOption", function(options, name) {
		return getOption(this, options, name);
	});
});

/**
 * addon/fold/foldgutter.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"), require("./foldcode"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror", "./foldcode"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	CodeMirror.defineOption("foldGutter", false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			cm.clearGutter(cm.state.foldGutter.options.gutter);
			cm.state.foldGutter = null;
			cm.off("gutterClick", onGutterClick);
			cm.off("changes", onChange);
			cm.off("viewportChange", onViewportChange);
			cm.off("fold", onFold);
			cm.off("unfold", onFold);
			cm.off("swapDoc", onChange);
		}
		if (val) {
			cm.state.foldGutter = new State(parseOptions(val));
			updateInViewport(cm);
			cm.on("gutterClick", onGutterClick);
			cm.on("changes", onChange);
			cm.on("viewportChange", onViewportChange);
			cm.on("fold", onFold);
			cm.on("unfold", onFold);
			cm.on("swapDoc", onChange);
		}
	});

	var Pos = CodeMirror.Pos;

	function State(options) {
		this.options = options;
		this.from = this.to = 0;
	}

	function parseOptions(opts) {
		if (opts === true) opts = {};
		if (opts.gutter == null) opts.gutter = "CodeMirror-foldgutter";
		if (opts.indicatorOpen == null) opts.indicatorOpen = "CodeMirror-foldgutter-open";
		if (opts.indicatorFolded == null) opts.indicatorFolded = "CodeMirror-foldgutter-folded";
		return opts;
	}

	function isFolded(cm, line) {
		var marks = cm.findMarks(Pos(line, 0), Pos(line + 1, 0));
		for (var i = 0; i < marks.length; ++i) {
			if (marks[i].__isFold) {
				var fromPos = marks[i].find(-1);
				if (fromPos && fromPos.line === line)
					return marks[i];
			}
		}
	}

	function marker(spec) {
		if (typeof spec == "string") {
			var elt = document.createElement("div");
			elt.className = spec + " CodeMirror-guttermarker-subtle";
			return elt;
		} else {
			return spec.cloneNode(true);
		}
	}

	function updateFoldInfo(cm, from, to) {
		var opts = cm.state.foldGutter.options, cur = from - 1;
		var minSize = cm.foldOption(opts, "minFoldSize");
		var func = cm.foldOption(opts, "rangeFinder");
		// we can reuse the built-in indicator element if its className matches the new state
		var clsFolded = typeof opts.indicatorFolded == "string" && classTest(opts.indicatorFolded);
		var clsOpen = typeof opts.indicatorOpen == "string" && classTest(opts.indicatorOpen);
		cm.eachLine(from, to, function(line) {
			++cur;
			var mark = null;
			var old = line.gutterMarkers;
			if (old) old = old[opts.gutter];
			if (isFolded(cm, cur)) {
				if (clsFolded && old && clsFolded.test(old.className)) return;
				mark = marker(opts.indicatorFolded);
			} else {
				var pos = Pos(cur, 0);
				var range = func && func(cm, pos);
				if (range && range.to.line - range.from.line >= minSize) {
					if (clsOpen && old && clsOpen.test(old.className)) return;
					mark = marker(opts.indicatorOpen);
				}
			}
			if (!mark && !old) return;
			cm.setGutterMarker(line, opts.gutter, mark);
		});
	}

	// copied from CodeMirror/src/util/dom.js
	function classTest(cls) { return new RegExp("(^|\\s)" + cls + "(?:$|\\s)\\s*") }

	function updateInViewport(cm) {
		var vp = cm.getViewport(), state = cm.state.foldGutter;
		if (!state) return;
		cm.operation(function() {
			updateFoldInfo(cm, vp.from, vp.to);
		});
		state.from = vp.from; state.to = vp.to;
	}

	function onGutterClick(cm, line, gutter) {
		var state = cm.state.foldGutter;
		if (!state) return;
		var opts = state.options;
		if (gutter != opts.gutter) return;
		var folded = isFolded(cm, line);
		if (folded) folded.clear();
		else cm.foldCode(Pos(line, 0), opts);
	}

	function onChange(cm) {
		var state = cm.state.foldGutter;
		if (!state) return;
		var opts = state.options;
		state.from = state.to = 0;
		clearTimeout(state.changeUpdate);
		state.changeUpdate = setTimeout(function() { updateInViewport(cm); }, opts.foldOnChangeTimeSpan || 600);
	}

	function onViewportChange(cm) {
		var state = cm.state.foldGutter;
		if (!state) return;
		var opts = state.options;
		clearTimeout(state.changeUpdate);
		state.changeUpdate = setTimeout(function() {
			var vp = cm.getViewport();
			if (state.from == state.to || vp.from - state.to > 20 || state.from - vp.to > 20) {
				updateInViewport(cm);
			} else {
				cm.operation(function() {
					if (vp.from < state.from) {
						updateFoldInfo(cm, vp.from, state.from);
						state.from = vp.from;
					}
					if (vp.to > state.to) {
						updateFoldInfo(cm, state.to, vp.to);
						state.to = vp.to;
					}
				});
			}
		}, opts.updateViewportTimeSpan || 400);
	}

	function onFold(cm, from) {
		var state = cm.state.foldGutter;
		if (!state) return;
		var line = from.line;
		if (line >= state.from && line < state.to)
			updateFoldInfo(cm, line, line + 1);
	}
});

/**
 * addon/fold/markdown-fold.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	CodeMirror.registerHelper("fold", "markdown", function(cm, start) {
		var maxDepth = 100;

		function isHeader(lineNo) {
			var tokentype = cm.getTokenTypeAt(CodeMirror.Pos(lineNo, 0));
			return tokentype && /\bheader\b/.test(tokentype);
		}

		function headerLevel(lineNo, line, nextLine) {
			var match = line && line.match(/^#+/);
			if (match && isHeader(lineNo)) return match[0].length;
			match = nextLine && nextLine.match(/^[=\-]+\s*$/);
			if (match && isHeader(lineNo + 1)) return nextLine[0] == "=" ? 1 : 2;
			return maxDepth;
		}

		var firstLine = cm.getLine(start.line), nextLine = cm.getLine(start.line + 1);
		var level = headerLevel(start.line, firstLine, nextLine);
		if (level === maxDepth) return undefined;

		var lastLineNo = cm.lastLine();
		var end = start.line, nextNextLine = cm.getLine(end + 2);
		while (end < lastLineNo) {
			if (headerLevel(end + 1, nextLine, nextNextLine) <= level) break;
			++end;
			nextLine = nextNextLine;
			nextNextLine = cm.getLine(end + 2);
		}

		return {
			from: CodeMirror.Pos(start.line, firstLine.length),
			to: CodeMirror.Pos(end, cm.getLine(end).length)
		};
	});

});

/**
 * addon/fold/indent-fold.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	function lineIndent(cm, lineNo) {
		var text = cm.getLine(lineNo)
		var spaceTo = text.search(/\S/)
		if (spaceTo == -1 || /\bcomment\b/.test(cm.getTokenTypeAt(CodeMirror.Pos(lineNo, spaceTo + 1))))
			return -1
		return CodeMirror.countColumn(text, null, cm.getOption("tabSize"))
	}

	CodeMirror.registerHelper("fold", "indent", function(cm, start) {
		var myIndent = lineIndent(cm, start.line)
		if (myIndent < 0) return
		var lastLineInFold = null

		// Go through lines until we find a line that definitely doesn't belong in
		// the block we're folding, or to the end.
		for (var i = start.line + 1, end = cm.lastLine(); i <= end; ++i) {
			var indent = lineIndent(cm, i)
			if (indent == -1) {
			} else if (indent > myIndent) {
				// Lines with a greater indent are considered part of the block.
				lastLineInFold = i;
			} else {
				// If this line has non-space, non-comment content, and is
				// indented less or equal to the start line, it is the start of
				// another block.
				break;
			}
		}
		if (lastLineInFold) return {
			from: CodeMirror.Pos(start.line, cm.getLine(start.line).length),
			to: CodeMirror.Pos(lastLineInFold, cm.getLine(lastLineInFold).length)
		};
	});

});

/**
 * addon/edit/continuelist.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	var listRE = /^(\s*)(>[> ]*|[*+-] \[.\]\s|[*+-]\s|(\d+)([.)]\s))(\s*)/,
		emptyListRE = /^(\s*)(>[> ]*|[*+-] \[.\]|[*+-]|(\d+)[.)]\s)(\s*)$/,
		unorderedListRE = /[*+-]\s/;

	CodeMirror.commands.newlineAndIndentContinueMarkdownList = function(cm) {
		if (cm.getOption("disableInput")) return CodeMirror.Pass;
		var ranges = cm.listSelections(), replacements = [];
		for (var i = 0; i < ranges.length; i++) {
			var pos = ranges[i].head;

			// If we're not in Markdown mode, fall back to normal newlineAndIndent
			var eolState = cm.getStateAfter(pos.line);
			var inner = CodeMirror.innerMode(cm.getMode(), eolState);
			if (inner.mode.name !== "markdown") {
				cm.execCommand("newlineAndIndent");
				return;
			} else {
				eolState = inner.state;
			}

			var inList = eolState.list !== false;
			var inQuote = eolState.quote !== 0;

			var line = cm.getLine(pos.line), match = listRE.exec(line);
			var cursorBeforeBullet = /^\s*$/.test(line.slice(0, pos.ch));
			if (!ranges[i].empty() || (!inList && !inQuote) || !match || cursorBeforeBullet) {
				cm.execCommand("newlineAndIndent");
				return;
			}
			if (emptyListRE.test(line)) {
				var endOfQuote = inQuote && />\s*$/.test(line)
				var endOfList = !/>\s*$/.test(line)
				if (endOfQuote || endOfList) cm.replaceRange("", {
					line: pos.line, ch: 0
				}, {
					line: pos.line, ch: pos.ch + 1
				});
				replacements[i] = "\n";
			} else {
				var indent = match[1], after = match[5];
				var numbered = !(unorderedListRE.test(match[2]) || match[2].indexOf(">") >= 0);
				var bullet = numbered ? (parseInt(match[3], 10) + 1) + match[4] : match[2].replace("x", " ");
				replacements[i] = "\n" + indent + bullet + after;

				if (numbered) incrementRemainingMarkdownListNumbers(cm, pos);
			}
		}

		cm.replaceSelections(replacements);
	};

	CodeMirror.commands.indentUnindentContinueMarkdownList = function (cm) {
		if (cm.getOption("disableInput")) {
			return CodeMirror.Pass;
		}
		var ranges = cm.listSelections(), replacements = [];
		for (var i = 0; i < ranges.length; i++) {
			var pos = ranges[i].head;
			fixMarkdownListNumbers(cm, pos.line, false);
			fixMarkdownListNumbers(cm, pos.line + 1, true);
		}
	};

	function fixMarkdownListNumbers(cm, lineNum, rest) {
		var eolState = cm.getStateAfter(lineNum);
		var inner = CodeMirror.innerMode(cm.getMode(), eolState);
		if (inner.mode.name !== "markdown") {
			return;
		}
		else {
			eolState = inner.state;
		}

		var inList = eolState.list !== false;
		var inQuote = eolState.quote !== 0;
		if (!inList && !inQuote) {
			return;
		}

		var thisLine = cm.getLine(lineNum), thisItem = listRE.exec(thisLine);
		if (!thisLine || !thisItem) {
			return;
		}

		var numbered = !(unorderedListRE.test(thisItem[2]) || thisItem[2].indexOf(">") >= 0);
		if (numbered) {
			var thisIndent = thisItem[1];
			// Look for a previous item of the same indent
			var prevLineNum = lineNum - 1;
			var lastNumber = 0;
			var lastList = null;
			while (prevLineNum >= 0) {
				let prevLineText = cm.getLine(prevLineNum);
				var prevItem = listRE.exec(prevLineText);
				if (!prevItem) {
					break;
				}
				var prevIndent = prevItem[1];
				if (prevIndent === thisIndent) {
					if (unorderedListRE.test(prevItem[2]) || prevItem[2].indexOf(">") >= 0) {
						lastList = prevItem[2];
					}
					else {
						lastNumber = parseInt(prevItem[3], 10);
					}
					break;
				}
				if (prevIndent.length < thisIndent.length) {
					break;
				}
				prevLineNum--;
			}

			// Keep previous list
			if (lastList) {
				cm.replaceRange(
					thisLine.replace(listRE, thisIndent + lastList + thisItem[5]),
					{line: lineNum, ch: 0}, {line: lineNum, ch: thisLine.length}
				);
				return;
			}

			lastNumber++;
			cm.replaceRange(
				thisLine.replace(listRE, thisIndent + lastNumber + thisItem[4] + thisItem[5]),
				{line: lineNum, ch: 0}, {line: lineNum, ch: thisLine.length}
			);

			var nextLineNum = lineNum + 1;
			while (true) {
				var nextLine = cm.getLine(nextLineNum), nextItem = listRE.exec(nextLine);

				if (!nextItem) {
					break;
				}
				var nextIndent = nextItem[1];
				var isNumber = !(unorderedListRE.test(nextItem[2]) || nextItem[2].indexOf(">") >= 0);

				if (nextIndent === thisIndent && isNumber) {
					lastNumber++;
					cm.replaceRange(
						nextLine.replace(listRE, nextIndent + lastNumber + nextItem[4] + nextItem[5]),
						{line: nextLineNum, ch: 0}, {line: nextLineNum, ch: nextLine.length}
					);
				}
				if (nextIndent.length < thisIndent.length) {
					break;
				}
				nextLineNum++;
			}
		}
	}

	// Auto-updating Markdown list numbers when a new item is added to the
	// middle of a list
	function incrementRemainingMarkdownListNumbers(cm, pos) {
		var startLine = pos.line, lookAhead = 0, skipCount = 0;
		var startItem = listRE.exec(cm.getLine(startLine)), startIndent = startItem[1];

		do {
			lookAhead += 1;
			var nextLineNumber = startLine + lookAhead;
			var nextLine = cm.getLine(nextLineNumber), nextItem = listRE.exec(nextLine);

			if (nextItem) {
				var nextIndent = nextItem[1];
				var newNumber = (parseInt(startItem[3], 10) + lookAhead - skipCount);
				var nextNumber = (parseInt(nextItem[3], 10)), itemNumber = nextNumber;
				var isNumber = !(unorderedListRE.test(nextItem[2]) || nextItem[2].indexOf(">") >= 0);

				if (startIndent === nextIndent && !isNaN(nextNumber) && isNumber) {
					if (newNumber === nextNumber) itemNumber = nextNumber + 1;
					if (newNumber > nextNumber) itemNumber = newNumber + 1;
					cm.replaceRange(
						nextLine.replace(listRE, nextIndent + itemNumber + nextItem[4] + nextItem[5]),
						{
							line: nextLineNumber, ch: 0
						}, {
							line: nextLineNumber, ch: nextLine.length
						});
				} else {
					if (startIndent.length > nextIndent.length) return;
					// This doesn't run if the next line immediatley indents, as it is
					// not clear of the users intention (new indented item or same level)
					if ((startIndent.length < nextIndent.length) && (lookAhead === 1)) return;
					skipCount += 1;
				}
			}
		} while (nextItem);
	}
});

/**
 * Modified version of addon/edit/indentlist.js from https://github.com/joel-porquet/CodeMirror-markdown-list-autoindent
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: http://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	var Pos = CodeMirror.Pos;
	var listTokenRE = /^(\s*)(>[> ]*|[*+-] \[[x ]\]|[*+-]|(\d+)[.)])(\s*)$/;
	var spaceRE = /^\s*$/;

	function matchListToken(pos, cm) {
		/* Get some info about the current state */
		var eolState = cm.getStateAfter(pos.line);
		var inList = eolState.list !== false;
		var inQuote = eolState.quote !== 0;

		/* Get the line from the start to where the cursor currently is */
		var lineStart = cm.getRange(Pos(pos.line, 0), pos);

		/* Matches the beginning of the list line with the list token RE */
		var match = listTokenRE.exec(lineStart);

		/* Not being in a list, or being in a list but not right after the list
		 * token, are both not considered a match */
		if ((!inList && !inQuote) || !match)
			return false
		else
			return true
	}

	CodeMirror.commands.autoIndentMarkdownList = function(cm) {
		if (cm.getOption("disableInput")) return CodeMirror.Pass;
		var ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			var pos = ranges[i].head;

			if (!ranges[i].empty() || !matchListToken(pos, cm)) {
				/* If no match, call regular Tab handler */
				cm.execCommand("defaultTab");
				cm.execCommand("indentUnindentContinueMarkdownList");
				return;
			}

			/* Select the whole list line and indent it by one unit */
			cm.indentLine(pos.line, "add");
			cm.execCommand("indentUnindentContinueMarkdownList");
		}
	};

	CodeMirror.commands.autoUnindentMarkdownList = function(cm) {
		if (cm.getOption("disableInput")) return CodeMirror.Pass;
		var ranges = cm.listSelections();
		for (var i = 0; i < ranges.length; i++) {
			var pos = ranges[i].head;

			if (!ranges[i].empty() || !matchListToken(pos, cm)) {
				/* If no match, call regular Shift-Tab handler */
				cm.execCommand("indentLess");
				cm.execCommand("indentUnindentContinueMarkdownList");
				return;
			}

			/* Select the whole list line and unindent it by one unit */
			cm.indentLine(pos.line, "subtract");
			cm.execCommand("indentUnindentContinueMarkdownList");
		}
	};
});

/**
 * addon/selection/active-line.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";
	var WRAP_CLASS = "CodeMirror-activeline";
	var BACK_CLASS = "CodeMirror-activeline-background";
	var GUTT_CLASS = "CodeMirror-activeline-gutter";

	CodeMirror.defineOption("styleActiveLine", false, function(cm, val, old) {
		var prev = old == CodeMirror.Init ? false : old;
		if (val == prev) return
		if (prev) {
			cm.off("beforeSelectionChange", selectionChange);
			clearActiveLines(cm);
			delete cm.state.activeLines;
		}
		if (val) {
			cm.state.activeLines = [];
			updateActiveLines(cm, cm.listSelections());
			cm.on("beforeSelectionChange", selectionChange);
		}
	});

	function clearActiveLines(cm) {
		for (var i = 0; i < cm.state.activeLines.length; i++) {
			cm.removeLineClass(cm.state.activeLines[i], "wrap", WRAP_CLASS);
			cm.removeLineClass(cm.state.activeLines[i], "background", BACK_CLASS);
			cm.removeLineClass(cm.state.activeLines[i], "gutter", GUTT_CLASS);
		}
	}

	function sameArray(a, b) {
		if (a.length != b.length) return false;
		for (var i = 0; i < a.length; i++)
			if (a[i] != b[i]) return false;
		return true;
	}

	function updateActiveLines(cm, ranges) {
		var active = [];
		for (var i = 0; i < ranges.length; i++) {
			var range = ranges[i];
			var option = cm.getOption("styleActiveLine");
			if (typeof option == "object" && option.nonEmpty ? range.anchor.line != range.head.line : !range.empty())
				continue
			var line = cm.getLineHandleVisualStart(range.head.line);
			if (active[active.length - 1] != line) active.push(line);
		}
		if (sameArray(cm.state.activeLines, active)) return;
		cm.operation(function() {
			clearActiveLines(cm);
			for (var i = 0; i < active.length; i++) {
				cm.addLineClass(active[i], "wrap", WRAP_CLASS);
				cm.addLineClass(active[i], "background", BACK_CLASS);
				cm.addLineClass(active[i], "gutter", GUTT_CLASS);
			}
			cm.state.activeLines = active;
		});
	}

	function selectionChange(cm, sel) {
		updateActiveLines(cm, sel.ranges);
	}
});

/**
 * addon/scroll/scrollpastend.js
 */

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	"use strict";

	CodeMirror.defineOption("scrollPastEnd", false, function(cm, val, old) {
		if (old && old != CodeMirror.Init) {
			cm.off("change", onChange);
			cm.off("refresh", updateBottomMargin);
			cm.display.lineSpace.parentNode.style.paddingBottom = "";
			cm.state.scrollPastEndPadding = null;
		}
		if (val) {
			cm.on("change", onChange);
			cm.on("refresh", updateBottomMargin);
			updateBottomMargin(cm);
		}
	});

	function onChange(cm, change) {
		if (CodeMirror.changeEnd(change).line == cm.lastLine())
			updateBottomMargin(cm);
	}

	function updateBottomMargin(cm) {
		var padding = "";
		if (cm.lineCount() > 1) {
			var totalH = cm.display.scroller.clientHeight - 30,
				lastLineH = cm.getLineHandle(cm.lastLine()).height;
			padding = (totalH / 2 - lastLineH) + "px";
		}
		if (cm.state.scrollPastEndPadding != padding) {
			cm.state.scrollPastEndPadding = padding;
			cm.display.lineSpace.parentNode.style.paddingBottom = padding;
			cm.off("refresh", updateBottomMargin);
			cm.setSize();
			cm.on("refresh", updateBottomMargin);
		}
	}
});

/**
 * addon/dialog/dialog.js
 */

// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

// Open simple dialogs on top of an editor. Relies on dialog.css.

(function(mod) {
	if (typeof exports == "object" && typeof module == "object") // CommonJS
		mod(require("../../lib/codemirror"));
	else if (typeof define == "function" && define.amd) // AMD
		define(["../../lib/codemirror"], mod);
	else // Plain browser env
		mod(CodeMirror);
})
(function(CodeMirror) {
	function dialogDiv(cm, template, bottom) {
		var wrap = cm.getWrapperElement();
		var dialog;
		dialog = wrap.appendChild(document.createElement("div"));
		if (bottom)
			dialog.className = "CodeMirror-dialog CodeMirror-dialog-bottom";
		else
			dialog.className = "CodeMirror-dialog CodeMirror-dialog-top";

		if (typeof template == "string") {
			dialog.innerHTML = template;
		} else { // Assuming it's a detached DOM element.
			dialog.appendChild(template);
		}
		CodeMirror.addClass(wrap, 'dialog-opened');
		return dialog;
	}

	function closeNotification(cm, newVal) {
		if (cm.state.currentNotificationClose)
			cm.state.currentNotificationClose();
		cm.state.currentNotificationClose = newVal;
	}

	CodeMirror.defineExtension("openDialog", function(template, callback, options) {
		if (!options) options = {};

		closeNotification(this, null);

		var dialog = dialogDiv(this, template, options.bottom);
		var closed = false, me = this;
		function close(newVal) {
			if (typeof newVal == 'string') {
				inp.value = newVal;
			} else {
				if (closed) return;
				closed = true;
				CodeMirror.rmClass(dialog.parentNode, 'dialog-opened');
				dialog.parentNode.removeChild(dialog);
				me.focus();

				if (options.onClose) options.onClose(dialog);
			}
		}

		var inp = dialog.getElementsByTagName("input")[0], button;
		if (inp) {
			inp.focus();

			if (options.value) {
				inp.value = options.value;
				if (options.selectValueOnOpen !== false) {
					inp.select();
				}
			}

			if (options.onInput)
				CodeMirror.on(inp, "input", function(e) { options.onInput(e, inp.value, close);});
			if (options.onKeyUp)
				CodeMirror.on(inp, "keyup", function(e) {options.onKeyUp(e, inp.value, close);});

			CodeMirror.on(inp, "keydown", function(e) {
				if (options && options.onKeyDown && options.onKeyDown(e, inp.value, close)) { return; }
				if (e.keyCode == 27 || (options.closeOnEnter !== false && e.keyCode == 13)) {
					inp.blur();
					CodeMirror.e_stop(e);
					close();
				}
				if (e.keyCode == 13) callback(inp.value, e);
			});

			if (options.closeOnBlur !== false) CodeMirror.on(dialog, "focusout", function (evt) {
				if (evt.relatedTarget !== null) close();
			});
		} else if (button = dialog.getElementsByTagName("button")[0]) {
			CodeMirror.on(button, "click", function() {
				close();
				me.focus();
			});

			if (options.closeOnBlur !== false) CodeMirror.on(button, "blur", close);

			button.focus();
		}
		return close;
	});

	CodeMirror.defineExtension("openConfirm", function(template, callbacks, options) {
		closeNotification(this, null);
		var dialog = dialogDiv(this, template, options && options.bottom);
		var buttons = dialog.getElementsByTagName("button");
		var closed = false, me = this, blurring = 1;
		function close() {
			if (closed) return;
			closed = true;
			CodeMirror.rmClass(dialog.parentNode, 'dialog-opened');
			dialog.parentNode.removeChild(dialog);
			me.focus();
		}
		buttons[0].focus();
		for (var i = 0; i < buttons.length; ++i) {
			var b = buttons[i];
			(function(callback) {
				CodeMirror.on(b, "click", function(e) {
					CodeMirror.e_preventDefault(e);
					close();
					if (callback) callback(me);
				});
			})(callbacks[i]);
			CodeMirror.on(b, "blur", function() {
				--blurring;
				setTimeout(function() { if (blurring <= 0) close(); }, 200);
			});
			CodeMirror.on(b, "focus", function() { ++blurring; });
		}
	});

	/*
	 * openNotification
	 * Opens a notification, that can be closed with an optional timer
	 * (default 5000ms timer) and always closes on click.
	 *
	 * If a notification is opened while another is opened, it will close the
	 * currently opened one and open the new one immediately.
	 */
	CodeMirror.defineExtension("openNotification", function(template, options) {
		closeNotification(this, close);
		var dialog = dialogDiv(this, template, options && options.bottom);
		var closed = false, doneTimer;
		var duration = options && typeof options.duration !== "undefined" ? options.duration : 5000;

		function close() {
			if (closed) return;
			closed = true;
			clearTimeout(doneTimer);
			CodeMirror.rmClass(dialog.parentNode, 'dialog-opened');
			dialog.parentNode.removeChild(dialog);
		}

		CodeMirror.on(dialog, 'click', function(e) {
			CodeMirror.e_preventDefault(e);
			close();
		});

		if (duration)
			doneTimer = setTimeout(close, duration);

		return close;
	});
});

// OBSIDIAN CUSTOM BEHAVIOR
// ALWAYS KEEP AT THE BOTTOM

let Pos = CodeMirror.Pos;
// from https://codemirror.net/keymap/sublime.js
CodeMirror.commands.swapLineUp = function(cm) {
	if (cm.isReadOnly()) return CodeMirror.Pass
	var ranges = cm.listSelections(), linesToMove = [], at = cm.firstLine() - 1, newSels = [];
	for (var i = 0; i < ranges.length; i++) {
		var range = ranges[i], from = range.from().line - 1, to = range.to().line;
		newSels.push({anchor: Pos(range.anchor.line - 1, range.anchor.ch),
			head: Pos(range.head.line - 1, range.head.ch)});
		if (range.to().ch == 0 && !range.empty()) --to;
		if (from > at) linesToMove.push(from, to);
		else if (linesToMove.length) linesToMove[linesToMove.length - 1] = to;
		at = to;
	}
	cm.operation(function() {
		for (var i = 0; i < linesToMove.length; i += 2) {
			var from = linesToMove[i], to = linesToMove[i + 1];
			var line = cm.getLine(from);
			cm.replaceRange("", Pos(from, 0), Pos(from + 1, 0), "+swapLine");
			if (to > cm.lastLine())
				cm.replaceRange("\n" + line, Pos(cm.lastLine()), null, "+swapLine");
			else
				cm.replaceRange(line + "\n", Pos(to, 0), null, "+swapLine");
		}
		cm.setSelections(newSels);
		cm.scrollIntoView();
	});
};

// from https://codemirror.net/keymap/sublime.js
CodeMirror.commands.swapLineDown = function(cm) {
	if (cm.isReadOnly()) return CodeMirror.Pass
	var ranges = cm.listSelections(), linesToMove = [], at = cm.lastLine() + 1;
	for (var i = ranges.length - 1; i >= 0; i--) {
		var range = ranges[i], from = range.to().line + 1, to = range.from().line;
		if (range.to().ch == 0 && !range.empty()) from--;
		if (from < at) linesToMove.push(from, to);
		else if (linesToMove.length) linesToMove[linesToMove.length - 1] = to;
		at = to;
	}
	cm.operation(function() {
		for (var i = linesToMove.length - 2; i >= 0; i -= 2) {
			var from = linesToMove[i], to = linesToMove[i + 1];
			var line = cm.getLine(from);
			if (from == cm.lastLine())
				cm.replaceRange("", Pos(from - 1), Pos(from), "+swapLine");
			else
				cm.replaceRange("", Pos(from, 0), Pos(from + 1, 0), "+swapLine");
			cm.replaceRange(line + "\n", Pos(to, 0), null, "+swapLine");
		}
		cm.scrollIntoView();
	});
};

CodeMirror.registerHelper('fold', 'frontmatter', function (cm, start) {
	if (cm.getLine(start.line) !== '---') {
		return undefined;
	}

	for (let prevLine = start.line - 1; prevLine >= 0; prevLine--) {
		if (cm.getLine(prevLine).trim()) {
			return undefined;
		}
	}

	var lastLineNo = cm.lastLine();
	var end = start.line + 1;
	while (end < lastLineNo) {
		if (cm.getLine(end) === '---') {
			break;
		}
		end++;
	}

	return {
		from: CodeMirror.Pos(start.line, 3),
		to: CodeMirror.Pos(end, 3)
	};
});

CodeMirror.commands.defaultTab = function (cm) {
	if (cm.somethingSelected()) {
		cm.execCommand('indentMore');
	}
	else {
		if (cm.getOption('indentWithTabs')) {
			cm.execCommand('insertTab');
		}
		else {
			cm.execCommand('insertSoftTab');
		}
	}
}
