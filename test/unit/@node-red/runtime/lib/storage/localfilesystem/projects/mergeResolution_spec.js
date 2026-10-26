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
var mergeResolution = NR_TEST_UTILS.require("@node-red/runtime/lib/storage/localfilesystem/projects/mergeResolution");

function block(changeStart, separator, changeEnd, selection) {
    var resolutions = {};
    resolutions[changeStart] = {
        changeStart: changeStart,
        separator: separator,
        changeEnd: changeEnd,
        selection: selection
    };
    return resolutions;
}

describe("storage/localfilesystem/projects/mergeResolution", function() {
    describe("merge conflict style", function() {
        var content = [
            "line1",
            "<<<<<<< HEAD",
            "MAIN",
            "=======",
            "SIDE",
            ">>>>>>> side",
            "line3"
        ].join("\n");

        it("keeps ours when selecting A", function() {
            mergeResolution.applyResolutions(content, block(2, 4, 6, "A"))
                .should.equal("line1\nMAIN\nline3");
        });

        it("keeps theirs when selecting B", function() {
            mergeResolution.applyResolutions(content, block(2, 4, 6, "B"))
                .should.equal("line1\nSIDE\nline3");
        });
    });

    describe("diff3 conflict style", function() {
        var content = [
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

        it("does not leak ||||||| or ancestor lines when selecting A", function() {
            var resolved = mergeResolution.applyResolutions(content, block(2, 6, 8, "A"));
            resolved.should.equal("line1\nMAIN\nline3");
            resolved.should.not.match(/\|\|\|\|\|\|\|/);
            resolved.should.not.match(/^line2$/m);
        });

        it("does not leak ||||||| or ancestor lines when selecting B", function() {
            var resolved = mergeResolution.applyResolutions(content, block(2, 6, 8, "B"));
            resolved.should.equal("line1\nSIDE\nline3");
            resolved.should.not.match(/\|\|\|\|\|\|\|/);
            resolved.should.not.match(/^line2$/m);
        });
    });

    describe("zdiff3 conflict style", function() {
        var content = [
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

        it("keeps ours and surrounding common lines when selecting A", function() {
            mergeResolution.applyResolutions(content, block(3, 7, 9, "A"))
                .should.equal("keepA\ncommon1\nMAIN\ncommon2\nkeepB");
        });

        it("keeps theirs and surrounding common lines when selecting B", function() {
            mergeResolution.applyResolutions(content, block(3, 7, 9, "B"))
                .should.equal("keepA\ncommon1\nSIDE\ncommon2\nkeepB");
        });
    });

    it("resolves a package.json conflict without producing invalid JSON", function() {
        var content = [
            "{",
            '  "name": "demo",',
            "<<<<<<< HEAD",
            '  "version": "1.0.0",',
            "||||||| abcdef0",
            '  "version": "0.9.0",',
            "=======",
            '  "version": "1.1.0",',
            ">>>>>>> side",
            '  "license": "MIT"',
            "}"
        ].join("\n");

        var local = mergeResolution.applyResolutions(content, block(3, 7, 9, "A"));
        JSON.parse(local).should.eql({ name: "demo", version: "1.0.0", license: "MIT" });

        var remote = mergeResolution.applyResolutions(content, block(3, 7, 9, "B"));
        JSON.parse(remote).should.eql({ name: "demo", version: "1.1.0", license: "MIT" });
    });

    it("resolves mixed A/B selections across two diff3 conflicts", function() {
        var content = [
            "a",
            "<<<<<<< HEAD",
            "L1",
            "||||||| base",
            "O1",
            "=======",
            "R1",
            ">>>>>>> side",
            "mid",
            "<<<<<<< HEAD",
            "L2",
            "||||||| base",
            "O2",
            "=======",
            "R2",
            ">>>>>>> side",
            "z"
        ].join("\n");
        var resolutions = Object.assign(block(2, 6, 8, "A"), block(10, 14, 16, "B"));
        mergeResolution.applyResolutions(content, resolutions)
            .should.equal("a\nL1\nmid\nR2\nz");
    });

    it("selecting A with an empty ours section drops the ancestor and theirs", function() {
        var content = [
            "line1",
            "<<<<<<< HEAD",
            "||||||| base",
            "orig",
            "=======",
            "SIDE",
            ">>>>>>> side",
            "line3"
        ].join("\n");
        mergeResolution.applyResolutions(content, block(2, 5, 7, "A"))
            .should.equal("line1\nline3");
    });

    it("accepts JSON-parsed string keys for resolution line numbers", function() {
        var content = [
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
        var resolutions = JSON.parse(JSON.stringify(block(2, 6, 8, "A")));
        mergeResolution.applyResolutions(content, resolutions)
            .should.equal("line1\nMAIN\nline3");
    });
});
