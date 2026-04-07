import { describe, expect, it } from "vitest";
import { adjustFeedPostComments, enrichFeedPosts, getRecentNotifications, getVisibleFeedPosts, updateFeedPostLike } from "./feed-page";

describe("feed-page helpers", () => {
    it("merges likes and comments into posts", () => {
        const posts = [
            { id: "post-1", title: "First" },
            { id: "post-2", title: "Second" },
        ];
        const likes = [
            { post_id: "post-1", user_id: "user-1" },
            { post_id: "post-1", user_id: "user-2" },
        ];
        const comments = [{ post_id: "post-1" }, { post_id: "post-2" }, { post_id: "post-2" }];

        expect(enrichFeedPosts(posts, likes, comments, "user-1")).toEqual([
            { id: "post-1", title: "First", likes_count: 2, is_liked: true, comments_count: 1 },
            { id: "post-2", title: "Second", likes_count: 0, is_liked: false, comments_count: 2 },
        ]);
    });

    it("updates like state and comment counts without going negative", () => {
        const posts = [{ id: "post-1", likes_count: 1, is_liked: false, comments_count: 0 }];

        expect(updateFeedPostLike(posts, "post-1", true)).toEqual([{ id: "post-1", likes_count: 2, is_liked: true, comments_count: 0 }]);
        expect(updateFeedPostLike(posts, "post-1", false)).toEqual([{ id: "post-1", likes_count: 0, is_liked: false, comments_count: 0 }]);
        expect(adjustFeedPostComments(posts, "post-1", -1)).toEqual([{ id: "post-1", likes_count: 1, is_liked: false, comments_count: 0 }]);
    });

    it("returns visible posts and recent notifications", () => {
        const posts = [
            { id: "post-1", is_liked: true },
            { id: "post-2", is_liked: false },
        ];

        expect(getVisibleFeedPosts(posts, false)).toHaveLength(2);
        expect(getVisibleFeedPosts(posts, true)).toEqual([{ id: "post-1", is_liked: true }]);
        expect(getRecentNotifications([1, 2, 3, 4], 2)).toEqual([1, 2]);
    });
});
