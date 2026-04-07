import { describe, expect, it } from "vitest";
import { applyMention, getMentionMatch } from "./comments";

describe("feed comment mention helpers", () => {
    it("detects a mention query at the cursor", () => {
        expect(getMentionMatch("Hey @ali", 8)).toEqual({ query: "ali", position: 4 });
        expect(getMentionMatch("Hey @ali there", 14)).toBeNull();
        expect(getMentionMatch("No mention here", 5)).toBeNull();
    });

    it("inserts the selected mention and returns the next cursor position", () => {
        expect(applyMention("Hey @ali", 4, "ali", "Alice Jones")).toEqual({
            text: "Hey @Alice Jones ",
            cursorPosition: 17,
        });
    });
});
