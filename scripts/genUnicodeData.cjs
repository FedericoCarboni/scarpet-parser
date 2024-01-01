'use strict';

const fs = require('fs');
const pkg = require('../package.json');
const assert = require('assert');
const dependencies = Object.keys(pkg.devDependencies);

// Importing unicode-properties at runtime would load into memory the whole Unicode Database.
// so we just use it here to build a custom map for our required information.
const unicodeProperties = require('unicode-properties');

// Should be unicode-13.0.0 since that's what the current Minecraft JRE (Java 17) supports.
const unicodePkg = dependencies.find((name) => /^@unicode\/unicode-\d/.test(name));

// Filter out code points above the UTF-16 single char code max 0xFFFF,
// Scarpet does not support supplementary characters so we don't either.
const nonSupplementary = (code) => code <= 0xffff;

const unicodeLetters = /** @type {number[]} */ (
    require(unicodePkg + '/General_Category/Letter/code-points.js')
).filter(nonSupplementary);
const unicodeDecimalDigits = /** @type {number[]} */ (
    require(unicodePkg + '/General_Category/Decimal_Number/code-points.js')
).filter(nonSupplementary);
const unicodeWhitespace = /** @type {number[]} */ (
    require(unicodePkg + '/Binary_Property/White_Space/code-points.js')
).filter(nonSupplementary);

// Generate entries for a map of char code to numeric value
const decimalDigitMap = unicodeDecimalDigits.map((charCode) => {
    const numericValue = unicodeProperties.getNumericValue(charCode);
    assert(numericValue !== null, String.fromCodePoint(charCode) + ' is not a digit?');
    return [charCode, numericValue];
});

// Java has its own rules for which characters are considered whitespace
const javaExtraSpace = [0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x1c, 0x1d, 0x1e, 0x1f];
const javaNonSpace = [0x00a0, 0x2007, 0x202f];

const javaWhitespace = Array.from(new Set([
    ...javaExtraSpace,
    ...unicodeWhitespace.filter((code) => !javaNonSpace.includes(code)),
]));

const stringify = (value) => JSON.stringify(JSON.stringify(value));

// Disable tooling for unicode.js to avoid running unnecessary checks on a large
// file. JSON.parse in the resulting code slightly speeds up first load.
const unicodeFile = `\
/* eslint-disable */
// @ts-nocheck
/**
 * @file Unicode data generated by ../scripts/genUnicodeData.cjs using ${unicodePkg} and unicode-properties
 */
/** @type {Set<number>} */
export const LETTER_CHAR_CODES = new Set(JSON.parse(${stringify(unicodeLetters)}));
/** @type {number[]} */
export const JAVA_WHITESPACE_CHAR_CODES = JSON.parse(${stringify(javaWhitespace)});
/** @type {Map<number, number>} */
export const DECIMAL_DIGIT_CHAR_CODES = new Map(JSON.parse(${stringify(decimalDigitMap)}));
`;

fs.writeFileSync('lib/unicode.js', unicodeFile);
