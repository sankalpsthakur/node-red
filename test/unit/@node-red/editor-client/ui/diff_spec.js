/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

var should = require("should");
var NR_TEST_UTILS = require("nr-test-utils");

var diffModulePath = NR_TEST_UTILS.resolve("@node-red/editor-client/src/js/ui/diff.js");
var mergeResolution = NR_TEST_UTILS.require("@node-red/runtime/lib/storage/localfilesystem/projects/mergeResolution");

var MERGE_DIFF = [
    "diff --cc f.txt",
    "index d791e9b,245d786..0000000",
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@@ -1,3 -1,3 +1,7 @@@",
    "  line1",
    "++<<<<<<< HEAD",
    " +MAIN",
    "++=======",
    "+ SIDE",
    "++>>>>>>> side",
    "  line3"
].join("\n");

var DIFF3_DIFF = [
    "diff --cc f.txt",
    "index d791e9b,245d786..0000000",
    "--- a/f.txt",
    "+++ b/f.txt",
    "@@@ -1,3 -1,3 +1,9 @@@",
    "  line1",
    "++<<<<<<< HEAD",
    " +MAIN",
    "++||||||| 44d5626",
    "++line2",
    "++=======",
    "+ SIDE",
    "++>>>>>>> side",
    "  line3"
].join("\n");

var ZDIFF3_DIFF = [
    "diff --cc g.txt",
    "index abc,def..0000000",
    "--- a/g.txt",
    "+++ b/g.txt",
    "@@@ -1,5 -1,5 +1,11 @@@",
    "  keepA",
    "  common1",
    "++<<<<<<< HEAD",
    " +MAIN",
    "++||||||| merged common ancestors",
    "++orig",
    "++=======",
    "+ SIDE",
    "++>>>>>>> zside",
    "  common2",
    "  keepB"
].join("\n");

var MERGE_FILE = [
    "line1",
    "<<<<<<< HEAD",
    "MAIN",
    "=======",
    "SIDE",
    ">>>>>>> side",
    "line3"
].join("\n");

var DIFF3_FILE = [
    "line1",
    "<<<<<<< HEAD",
    "MAIN",
    "||||||| 44d5626",
    "line2",
    "=======",
    "SIDE",
    ">>>>>>> side",
    "line3"
].join("\n");

var ZDIFF3_FILE = [
    "keepA",
    "common1",
    "<<<<<<< HEAD",
    "MAIN",
    "||||||| merged common ancestors",
    "orig",
    "=======",
    "SIDE",
    ">>>>>>> zside",
    "common2",
    "keepB"
].join("\n");

describe("editor-client/ui/diff conflict markers", function() {
    var diff;

    beforeEach(function() {
        global.RED = {};
        delete require.cache[diffModulePath];
        diff = require(diffModulePath);
    });

    afterEach(function() {
        delete global.RED;
        delete require.cache[diffModulePath];
    });

    describe("getConflictMarkerKind", function() {
        it("recognises 2-way merge headers", function() {
            diff.getConflictMarkerKind("++<<<<<<< HEAD").should.equal("ours");
            diff.getConflictMarkerKind("++=======").should.equal("separator");
            diff.getConflictMarkerKind("++>>>>>>> side").should.equal("theirs");
        });

        it("recognises diff3/zdiff3 ||||||| base headers", function() {
            diff.getConflictMarkerKind("++||||||| 44d5626").should.equal("base");
            diff.getConflictMarkerKind("++||||||| merged common ancestors").should.equal("base");
        });

        it("does not treat ancestor content or side lines as headers", function() {
            should(diff.getConflictMarkerKind("++line2")).be.null();
            should(diff.getConflictMarkerKind(" +MAIN")).be.null();
            should(diff.getConflictMarkerKind("+ SIDE")).be.null();
        });
    });

    it("maps 2-way merge markers to file line numbers", function() {
        var hunk = diff.parseUnifiedDiff(MERGE_DIFF)[0].hunks[0];
        hunk.conflict.should.be.true();
        diff.getConflictMarkerPositions(hunk).should.eql({
            changeStart: 2,
            separator: 4,
            changeEnd: 6
        });
    });

    it("maps diff3 markers including the ||||||| base section", function() {
        var hunk = diff.parseUnifiedDiff(DIFF3_DIFF)[0].hunks[0];
        diff.getConflictMarkerPositions(hunk).should.eql({
            changeStart: 2,
            baseSeparator: 4,
            separator: 6,
            changeEnd: 8
        });
    });

    it("maps zdiff3 markers the same way as diff3", function() {
        var hunk = diff.parseUnifiedDiff(ZDIFF3_DIFF)[0].hunks[0];
        diff.getConflictMarkerPositions(hunk).should.eql({
            changeStart: 3,
            baseSeparator: 5,
            separator: 7,
            changeEnd: 9
        });
    });

    function resolveFromDiff(diffText, fileContent, selection) {
        var hunk = diff.parseUnifiedDiff(diffText)[0].hunks[0];
        var positions = diff.getConflictMarkerPositions(hunk);
        var resolutions = {};
        resolutions[positions.changeStart] = {
            changeStart: positions.changeStart,
            separator: positions.separator,
            changeEnd: positions.changeEnd,
            selection: selection
        };
        return mergeResolution.applyResolutions(fileContent, resolutions);
    }

    it("resolves 2-way merge markers for A and B", function() {
        resolveFromDiff(MERGE_DIFF, MERGE_FILE, "A").should.equal("line1\nMAIN\nline3");
        resolveFromDiff(MERGE_DIFF, MERGE_FILE, "B").should.equal("line1\nSIDE\nline3");
    });

    it("resolves diff3 markers for A and B without leaking the base section", function() {
        resolveFromDiff(DIFF3_DIFF, DIFF3_FILE, "A").should.equal("line1\nMAIN\nline3");
        resolveFromDiff(DIFF3_DIFF, DIFF3_FILE, "B").should.equal("line1\nSIDE\nline3");
    });

    it("resolves zdiff3 markers for A and B without leaking the base section", function() {
        resolveFromDiff(ZDIFF3_DIFF, ZDIFF3_FILE, "A").should.equal("keepA\ncommon1\nMAIN\ncommon2\nkeepB");
        resolveFromDiff(ZDIFF3_DIFF, ZDIFF3_FILE, "B").should.equal("keepA\ncommon1\nSIDE\ncommon2\nkeepB");
    });
});
