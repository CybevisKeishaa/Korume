import { describe, expect, it } from "vitest";
import { sanitizeKanjivgSvg, UnsafeKanjivgError } from "./sanitize-kanjivg";

// 緑 trimmed to two strokes, written in reverse document order to prove ordering by stroke id.
const GREEN = `<?xml version="1.0" encoding="UTF-8"?>
<!--
Copyright (C) 2009/2010/2011 Ulrich Apel.
-->
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.0//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd" [
<!ATTLIST g
xmlns:kvg CDATA #FIXED "http://kanjivg.tagaini.net"
kvg:element CDATA #IMPLIED >
]>
<svg xmlns="http://www.w3.org/2000/svg" width="109" height="109" viewBox="0 0 109 109" xmlns:kvg="https://kanjivg.tagaini.net/">
<g id="kvg:StrokePaths_07dd1" style="fill:none;stroke:#000000;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;">
<g id="kvg:07dd1" kvg:element="緑">
	<g id="kvg:07dd1-g1" kvg:element="糸" kvg:position="left" kvg:radical="general">
		<path id="kvg:07dd1-s2" kvg:type="㇜" d="M38.28,25.69c0.22,1.06-0.05,2.67-0.75,3.69"/>
		<path id="kvg:07dd1-s1" kvg:type="㇜" d="M27.65,14c0.31,1.21,0.26,2.45-0.41,3.69"/>
	</g>
	<g id="kvg:07dd1-g2" kvg:element="彔" kvg:variant="true" kvg:position="right" kvg:phon="彔V">
		<g id="kvg:07dd1-g3" kvg:element="⺕" kvg:original="彑"/>
	</g>
</g>
</g>
<g id="kvg:StrokeNumbers_07dd1" style="font-size:8;fill:#808080">
	<text transform="matrix(1 0 0 1 20.50 14.50)">1</text>
</g>
</svg>`;

function withPath(attributes: string): string {
  return GREEN.replace(`<path id="kvg:07dd1-s1"`, `<path ${attributes} id="kvg:07dd1-s1"`);
}

describe("sanitizeKanjivgSvg", () => {
  it("returns stroke paths in kvg stroke order and the element tree", () => {
    const { paths, components } = sanitizeKanjivgSvg(GREEN);
    expect(paths).toEqual([
      "M27.65,14c0.31,1.21,0.26,2.45-0.41,3.69",
      "M38.28,25.69c0.22,1.06-0.05,2.67-0.75,3.69",
    ]);
    expect(components).toEqual({
      element: "緑",
      position: null,
      children: [
        { element: "糸", position: "left", children: [] },
        { element: "彔", position: "right", children: [{ element: "⺕", position: null, children: [] }] },
      ],
    });
  });

  it.each([
    ["a script element", GREEN.replace("</svg>", "<script>alert(1)</script></svg>")],
    ["a foreignObject", GREEN.replace("</svg>", "<foreignObject><div/></foreignObject></svg>")],
    ["an onload attribute", withPath(`onload="alert(1)"`)],
    ["an href", withPath(`href="http://evil.example/x"`)],
    ["an xlink:href", withPath(`xlink:href="http://evil.example/x"`)],
    ["a style with url()", GREEN.replace("font-size:8;fill:#808080", "background:url(x)")],
    ["path data outside the SVG path alphabet", GREEN.replace("M27.65,14c0.31", "M27.65,14c0.31;url(x)")],
    ["a stroke path without a stroke id", withPath("").replace(`id="kvg:07dd1-s1"`, `id="x"`)],
    ["a processing instruction", GREEN.replace("<svg ", `<?xml-stylesheet href="x.css"?><svg `)],
  ])("rejects %s", (_label, svg) => {
    expect(() => sanitizeKanjivgSvg(svg)).toThrow(UnsafeKanjivgError);
  });
});
