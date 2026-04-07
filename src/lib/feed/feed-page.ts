interface FeedLikeRow {
    post_id: string;
    user_id: string;
}

interface FeedCommentRow {
    post_id: string;
}

export function enrichFeedPosts<T extends { id: string }>(
    posts: T[],
    likes: FeedLikeRow[] | null | undefined,
    comments: FeedCommentRow[] | null | undefined,
    currentUserId?: string,
): Array<T & { likes_count: number; is_liked: boolean; comments_count: number }> {
    const likesCountMap = new Map<string, number>();
    const userLikedMap = new Map<string, boolean>();
    const commentsCountMap = new Map<string, number>();

    likes?.forEach((like) => {
        likesCountMap.set(like.post_id, (likesCountMap.get(like.post_id) || 0) + 1);
        if (like.user_id === currentUserId) {
            userLikedMap.set(like.post_id, true);
        }
    });

    comments?.forEach((comment) => {
        commentsCountMap.set(comment.post_id, (commentsCountMap.get(comment.post_id) || 0) + 1);
    });

    return posts.map((post) => ({
        ...post,
        likes_count: likesCountMap.get(post.id) || 0,
        is_liked: userLikedMap.get(post.id) || false,
        comments_count: commentsCountMap.get(post.id) || 0,
    }));
}

export function updateFeedPostLike<T extends { id: string; likes_count?: number; is_liked?: boolean }>(
    posts: T[],
    postId: string,
    isLiked: boolean,
): T[] {
    return posts.map((post) =>
        post.id === postId
            ? {
                  ...post,
                  is_liked: isLiked,
                  likes_count: Math.max(0, (post.likes_count || 0) + (isLiked ? 1 : -1)),
              }
            : post,
    );
}

export function adjustFeedPostComments<T extends { id: string; comments_count?: number }>(posts: T[], postId: string, delta: number): T[] {
    return posts.map((post) =>
        post.id === postId
            ? {
                  ...post,
                  comments_count: Math.max(0, (post.comments_count || 0) + delta),
              }
            : post,
    );
}

export function getVisibleFeedPosts<T extends { is_liked?: boolean }>(posts: T[], showingLiked: boolean): T[] {
    return posts.filter((post) => !showingLiked || post.is_liked);
}

export function getRecentNotifications<T>(notifications: T[], limit = 3): T[] {
    return notifications.slice(0, limit);
}
