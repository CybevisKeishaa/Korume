import { describe, expect, it } from "vitest";
import en from "./community.json";

/**
 * Characterization test for `community.json` (Task 16): a literal `toBe` pin
 * for every `community.*` leaf, copied verbatim from the pre-extraction
 * source of `app/[locale]/(app)/community/{page,[id]/page,peer-review/page}.tsx`
 * and `components/community/{community-tabs,forum-board,forum-composer,
 * forum-post-item,forum-thread,peer-review-mine,peer-review-queue,
 * peer-review-tabs}.tsx` on `layer-9a-string-extraction` before Task 16
 * (never derived from the catalog itself — binding pattern 2).
 *
 * Forum post/comment bodies and titles (user-authored content, spec D8) are
 * never in this catalog — only the surrounding chrome is pinned here.
 */
describe("community.json EN — community/page.tsx + community/peer-review/page.tsx", () => {
  it("pins the shared 'Community' heading and the forum board's subtitle", () => {
    expect(en.page.heading).toBe("Community");
    expect(en.page.subtitle).toBe(
      "Ask questions, share tips, and give each other feedback on shadowing recordings.",
    );
    expect(en.page.signInPrompt).toBe("Sign in to post or comment.");
  });

  it("pins the peer-review page's own subtitle (reuses page.heading for its 'Community' h1)", () => {
    expect(en.peerReviewPage.subtitle).toBe(
      "Listen to a shadowing take shared by another learner and leave a rating and comment, or manage the recordings you've shared.",
    );
  });
});

describe("community.json EN — community/[id]/page.tsx", () => {
  it("pins the back-to-community link", () => {
    expect(en.postPage.back).toBe("← Back to community");
  });
});

describe("community.json EN — community-tabs.tsx", () => {
  it("pins the section nav's accessible name and the two tab labels", () => {
    expect(en.tabs.sectionsAriaLabel).toBe("Community sections");
    expect(en.tabs.forum).toBe("Forum");
    expect(en.tabs.peerReview).toBe("Peer review");
  });
});

describe("community.json EN — the seven forum topics, shared by forum-board/forum-composer/forum-thread/forum-post-item", () => {
  it("pins the 'All' filter-only chip and each of the seven topic labels, paired correctly", () => {
    expect(en.topics.all).toBe("All");
    expect(en.topics.general).toBe("General");
    expect(en.topics.grammar).toBe("Grammar");
    expect(en.topics.vocab).toBe("Vocab");
    expect(en.topics.listening).toBe("Listening");
    expect(en.topics.speaking).toBe("Speaking");
    expect(en.topics.jlpt).toBe("JLPT");
    expect(en.topics["study-tips"]).toBe("Study tips");
  });
});

describe("community.json EN — shared 'Deleted user' fallback (forum-post-item/forum-thread/peer-review-mine/peer-review-queue)", () => {
  it("pins the deleted-author fallback", () => {
    expect(en.deletedUser).toBe("Deleted user");
  });
});

describe("community.json EN — forum-board.tsx", () => {
  it("pins the topic-filter group's accessible name and the new-post toggle", () => {
    expect(en.board.topicFilterAriaLabel).toBe("Filter by topic");
    expect(en.board.newPost).toBe("New post");
  });

  it("pins the empty-topic state and the load-error message", () => {
    expect(en.board.empty).toBe("No posts yet in this topic — be the first to start a discussion.");
    expect(en.board.loadError).toBe("Couldn't load posts — please try again.");
  });
});

describe("community.json EN — forum-post-item.tsx", () => {
  it("pins the comment-count plural (singular and plural branches)", () => {
    expect(en.postItem.commentCount).toBe("{count, plural, one {{count} comment} other {{count} comments}}");
  });
});

describe("community.json EN — forum-composer.tsx", () => {
  it("pins the field labels and submit-button states", () => {
    expect(en.composer.titleLabel).toBe("Title");
    expect(en.composer.topicLabel).toBe("Topic");
    expect(en.composer.contentLabel).toBe("Content");
    expect(en.composer.post).toBe("Post");
    expect(en.composer.posting).toBe("Posting…");
    expect(en.composer.posted).toBe("Posted.");
  });

  it("pins the 429 and generic post-error messages", () => {
    expect(en.composer.tooManyWithSeconds).toBe("Too many posts — try again in {seconds}s.");
    expect(en.composer.tooManyGeneric).toBe("Too many posts — please wait a moment and try again.");
    expect(en.composer.postError).toBe("Couldn't post — please try again.");
  });
});

describe("community.json EN — forum-thread.tsx", () => {
  it("pins the own-post edit/delete controls", () => {
    expect(en.thread.editPost).toBe("Edit post");
    expect(en.thread.deletePost).toBe("Delete post");
    expect(en.thread.deletePostConfirm).toBe("Delete this post? This can't be undone.");
  });

  it("pins the optimistic 'You' author placeholder for a just-posted comment", () => {
    expect(en.thread.you).toBe("You");
  });

  it("pins the post-edit save/delete and comment-post error fallbacks (never a leaked server diagnostic)", () => {
    expect(en.thread.saveChangesError).toBe("Couldn't save your changes — please try again.");
    expect(en.thread.deletePostError).toBe("Couldn't delete your post — please try again.");
    expect(en.thread.postCommentError).toBe("Couldn't post your comment — please try again.");
  });

  it("pins the post edit-save busy state", () => {
    expect(en.thread.saving).toBe("Saving…");
  });

  it("pins the comments section heading and the empty-comments state", () => {
    expect(en.thread.commentsHeading).toBe("Comments");
    expect(en.thread.noComments).toBe("No comments yet — be the first to reply.");
  });

  it("pins the own-comment edit/delete controls", () => {
    expect(en.thread.editComment).toBe("Edit comment");
    expect(en.thread.deleteComment).toBe("Delete comment");
    expect(en.thread.deleteCommentConfirm).toBe("Delete this comment?");
    expect(en.thread.editCommentAriaLabel).toBe("Edit comment content");
  });

  it("pins the new-comment form's label, placeholder, and submit-button states", () => {
    expect(en.thread.commentLabel).toBe("Comment");
    expect(en.thread.commentPlaceholder).toBe("Write a reply…");
    expect(en.thread.commentButton).toBe("Comment");
    expect(en.thread.posting).toBe("Posting…");
  });

  it("pins the two distinct rate-limit message families (requests vs. comments), each with/without a retry-after seconds count", () => {
    expect(en.thread.tooManyRequestsWithSeconds).toBe("Too many requests — try again in {seconds}s.");
    expect(en.thread.tooManyRequestsGeneric).toBe("Too many requests — please wait a moment and try again.");
    expect(en.thread.tooManyCommentsWithSeconds).toBe("Too many comments — try again in {seconds}s.");
    expect(en.thread.tooManyCommentsGeneric).toBe("Too many comments — please wait a moment and try again.");
  });
});

describe("community.json EN — peer-review-mine.tsx", () => {
  it("pins the empty state, the revoke control, and the shared-timestamp prefix", () => {
    expect(en.peerReviewMine.empty).toBe("You haven't shared any recordings for peer feedback yet.");
    expect(en.peerReviewMine.revoke).toBe("Revoke");
    expect(en.peerReviewMine.revokeConfirm).toBe(
      "Revoke this share? This deletes the reviews too, and can't be undone.",
    );
    expect(en.peerReviewMine.sharedPrefix).toBe("Shared");
  });

  it("pins the no-reviews-yet state, the star-rating accessible label, and the revoke-error fallback", () => {
    expect(en.peerReviewMine.noReviews).toBe("No reviews yet.");
    expect(en.peerReviewMine.starsAriaLabel).toBe("{rating} out of 5 stars");
    expect(en.peerReviewMine.revokeError).toBe("Couldn't revoke that share — please try again.");
  });
});

describe("community.json EN — peer-review-queue.tsx", () => {
  it("pins the review-count plural and the Listen control", () => {
    expect(en.peerReviewQueue.reviewCount).toBe("{count, plural, one {{count} review} other {{count} reviews}}");
    expect(en.peerReviewQueue.listen).toBe("Listen");
  });

  it("pins the recording accessible-name template and its 'This user' fallback", () => {
    expect(en.peerReviewQueue.recordingAriaLabel).toBe("{name}'s recording");
    expect(en.peerReviewQueue.thisUser).toBe("This user");
  });

  it("pins the load/expired-link error messages and the already-reviewed state", () => {
    expect(en.peerReviewQueue.loadRecordingError).toBe("Couldn't load this recording — please try again.");
    expect(en.peerReviewQueue.expiredError).toBe("That link expired — try listening again.");
    expect(en.peerReviewQueue.alreadyReviewed).toBe("You've already reviewed this recording.");
  });

  it("pins the rating fieldset legend and the comment field label", () => {
    expect(en.peerReviewQueue.ratingLegend).toBe("Rating");
    expect(en.peerReviewQueue.commentLabel).toBe("Comment");
  });

  it("pins the submit-review button states and its three distinct failure messages", () => {
    expect(en.peerReviewQueue.submitReview).toBe("Submit review");
    expect(en.peerReviewQueue.submitting).toBe("Submitting…");
    expect(en.peerReviewQueue.ownShareError).toBe("You cannot review your own share.");
    expect(en.peerReviewQueue.submitError).toBe("Couldn't submit your review — please try again.");
  });

  it("pins the rate-limit, empty-queue, and load-more-error messages", () => {
    expect(en.peerReviewQueue.tooManyRequestsWithSeconds).toBe("Too many requests — try again in {seconds}s.");
    expect(en.peerReviewQueue.tooManyRequestsGeneric).toBe(
      "Too many requests — please wait a moment and try again.",
    );
    expect(en.peerReviewQueue.empty).toBe("Nothing to review right now — check back later.");
    expect(en.peerReviewQueue.loadMoreError).toBe("Couldn't load more — please try again.");
  });
});

describe("community.json EN — peer-review-tabs.tsx", () => {
  it("pins the tablist's accessible name and the two tab labels", () => {
    expect(en.peerReviewTabs.tablistAriaLabel).toBe("Peer review");
    expect(en.peerReviewTabs.queue).toBe("Queue");
    expect(en.peerReviewTabs.mine).toBe("Mine");
  });
});
