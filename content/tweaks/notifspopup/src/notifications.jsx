import { createRef } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { shouldReduceMotion, useSpring, useAnimation } from './animation.jsx';
import { TimeIcon, TimeAnchorEditor } from './time-anchor.jsx';
import { STRINGS } from './strings.js';
import { ICONS } from './icons.jsx';
import './notifications.less';

let globalCachedLoginInfo;
function loadLoginInfo() {
    if (globalCachedLoginInfo) {
        return globalCachedLoginInfo;
    }
    return fetch(new URL('/api/v1/trpc/login.loggedIn?batch=1&input=%7B%7D', document.location.href)).then(async res => {
        if (res.ok) return res.json();
        throw await res.text();
    }).then(batch => {
        return globalCachedLoginInfo = batch[0].result.data;
    });
}

function separateSharesWithTags(notifications, data) {
    const out = [];

    for (const notif of notifications) {
        if (notif.type === 'groupedShare') {
            // separate out shares with tags
            const groupedIds = [];
            const separatedIds = [];
            let groupedCreatedAt = notif.oldestCreatedAt || notif.createdAt;
            for (let i = 0; i < notif.sharePostIds.length; i++) {
                const projectId = notif.fromProjectIds[i];
                const sharePostId = notif.sharePostIds[i];
                const sharePost = data.posts[sharePostId];
                if (sharePost?.tags?.length) {
                    separatedIds.push([projectId, sharePostId]);
                } else {
                    groupedIds.push([projectId, sharePostId]);

                    const sharePostCreatedAt = sharePost?.publishedAt;
                    if (sharePostCreatedAt && (!groupedCreatedAt
                        || +new Date(sharePostCreatedAt) > +new Date(groupedCreatedAt))) {
                        groupedCreatedAt = sharePostCreatedAt;
                    }
                }
            }

            if (groupedIds.length) {
                out.push({
                    ...notif,
                    createdAt: groupedCreatedAt,
                    fromProjectIds: groupedIds.map(x => x[0]),
                    sharePostIds: groupedIds.map(x => x[1]),
                });
            }
            for (const [proj, post] of separatedIds) {
                out.push({
                    ...notif,
                    type: 'share',
                    fromProjectId: proj,
                    sharePostId: post,
                    createdAt: data.posts[post].publishedAt,
                });
            }
        } else {
            out.push(notif);
        }
    }

    return out;
}

function restoreSingleNotifications(notifications) {
    // check for ruses & tricks
    const out = [];

    for (const notif of notifications) {
        if (notif.type.startsWith('grouped') && notif.fromProjectIds.length === 1) {
            out.push({
                ...notif,
                type: notif.type.substring('grouped'.length).toLowerCase(),
                fromProjectId: notif.fromProjectIds[0],
                relationshipId: notif.relationshipIds && notif.relationshipIds[0],
                sharePostId: notif.sharePostIds && notif.sharePostIds[0],
            });
        } else {
            out.push(notif);
        }
    }

    return out;
}

function loadNotifs({ limit, beforeDate, showShareTags }) {
    const before = beforeDate ? `&before=${encodeURIComponent(beforeDate.toISOString())}` : '';
    return fetch(new URL(`/api/v1/notifications/list?limit=${limit}${before}`, document.location.href)).then(async res => {
        if (res.ok) return res.json();
        throw await res.text();
    }).then(data => {
        let notifications = data.notifications;

        if (showShareTags) notifications = separateSharesWithTags(notifications, data);
        notifications = restoreSingleNotifications(notifications);

        notifications.sort((a, b) => {
            return +new Date(b.createdAt) - +new Date(a.createdAt);
        });

        return { ...data, notifications };
    });
}

const NOTIFS_PER_PAGE = 40;
const SHOW_SHARE_TAGS = true;

export function Notifications({ isFloating, onClose }) {
    const [timeAnchor, setTimeAnchor] = useState(null);
    const [timeIconValue, setTimeIconValue] = useState(null);
    const [tab, setTab] = useState(null);

    const load = (beforeDate = null) => {
        return Promise.all([
            loadLoginInfo(),
            loadNotifs({
                limit: NOTIFS_PER_PAGE,
                showShareTags: SHOW_SHARE_TAGS,
                beforeDate,
            }),
        ]);
    };

    return (
        <div class="np-notifications">
            <header class="np-header" aria-label={STRINGS.header.label}>
                <div class="np-title">
                    {isFloating ? (
                        <button class="np-header-button" aria-label={STRINGS.header.close} onClick={onClose}>
                            <div class="np-close-icon" />
                        </button>
                    ) : null}
                    <h1 class="np-inner-title">
                        {tab === 'time' ? (
                            STRINGS.header.timeTitle
                        ) : (
                            STRINGS.header.title
                        )}
                    </h1>
                </div>
                <div class="np-header-controls">
                    <button
                        class={'np-header-button' + (tab === 'time' ? ' np-is-active' : '')}
                        aria-label={STRINGS.header.setTime}
                        title={STRINGS.header.setTime}
                        onClick={() => {
                            if (tab === 'time') {
                                setTab(null);
                                setTimeAnchor(null);
                            } else setTab('time');
                        }}>
                        <TimeIcon value={(tab === 'time') ? timeIconValue : null} />
                    </button>
                    <a class="np-open" href="/rc/project/notifications">{STRINGS.header.openPage}</a>
                </div>
            </header>
            {(tab === 'time') ? (
                <TimeAnchorEditor value={timeAnchor} onChange={setTimeAnchor} onIconValueChange={setTimeIconValue} />
            ) : (tab === 'settings') ? (
                'todo'
            ) : null}
            <div class="np-scroll-contents">
                <NotifsList timeAnchor={timeAnchor} load={load} />
            </div>
        </div>
    );
}

function getNotificationId(notification) {
    if (notification.type === 'groupedLike') return notification.createdAt + 'likes' + notification.relationshipIds[0];
    if (notification.type === 'like') return notification.createdAt + 'like' + notification.relationshipId;
    if (notification.type === 'groupedShare') return notification.createdAt + 'shares' + notification.sharePostIds[0];
    if (notification.type === 'share') return notification.createdAt + 'share' + notification.sharePostId;
    if (notification.type === 'groupedFollow') return notification.createdAt + 'follows' + notification.fromProjectIds[0];
    if (notification.type === 'follow') return notification.createdAt + 'follow' + notification.fromProjectId;
    if (notification.type === 'comment') return notification.createdAt + 'comment' + notification.commentId;
}

function getLocalDateKey(date) {
    return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate();
}

const SOURCE = Symbol('sourceData');
function NotifsList({ timeAnchor, load }) {
    const [login, setLogin] = useState({ projectId: 0 });
    const data = useRef({
        comments: {},
        notifications: {},
        posts: {},
        projects: {},
    }).current; // setState is not very useful here since this will be write-only
    const [notifications, setNotifications] = useState([]);
    const highlightRefs = useRef({});

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const loadMoreNotifications = () => {
        let beforeDate = timeAnchor;
        if (notifications.length) {
            const currentOldest = data.notifications[notifications[notifications.length - 1]];
            beforeDate = new Date(currentOldest[SOURCE].nextBefore);
        }

        setError(null);
        setLoading(true);

        load(beforeDate).then(([login, newData]) => {
            setLogin(login);

            for (const commentId in newData.comments) data.comments[commentId] = newData.comments[commentId];
            for (const postId in newData.posts) data.posts[postId] = newData.posts[postId];
            for (const projectId in newData.projects) data.projects[projectId] = newData.projects[projectId];

            const notifsToInsert = [];
            for (const notification of newData.notifications) {
                const id = getNotificationId(notification);
                notification[SOURCE] = newData;
                data.notifications[id] = notification;
                notifsToInsert.push(id);
            }

            setTimeout(() => {
                const nodeRef = highlightRefs.current[notifsToInsert[0]];
                nodeRef?.current?.focus();
            }, 100);

            const newNotifs = notifications.slice();
            newNotifs.push(...notifsToInsert);
            setNotifications(newNotifs);
        }).catch(error => {
            console.error(error);
            setError(error);
        }).finally(() => {
            setLoading(false);
        });
    };

    const loadOnNextRender = useRef(false);
    useEffect(() => {
        setNotifications([]);
        loadOnNextRender.current = true;
    }, [timeAnchor]);

    if (loadOnNextRender.current) {
        loadOnNextRender.current = false;
        requestAnimationFrame(() => {
            loadMoreNotifications();
        });
    }

    const items = [];
    let currentDateItems = [];
    let lastDateKey = null;
    const lastNotification = notifications[notifications.length - 1];
    for (const id of notifications) {
        const isLast = id === lastNotification;
        const notif = data.notifications[id];
        const dateKey = getLocalDateKey(new Date(notif.createdAt));

        if (dateKey !== lastDateKey) {
            if (currentDateItems.length) {
                items.push(<DateNotifications items={currentDateItems} />);
            }
            currentDateItems = [];

            lastDateKey = dateKey;
            items.push(<DateHeader key={dateKey} date={new Date(notif.createdAt)} />);
        }

        if (!highlightRefs.current[id]) highlightRefs.current[id] = createRef();
        currentDateItems.push(
            <Notification
                highlightRef={highlightRefs.current[id]}
                key={id}
                isLast={isLast}
                login={login}
                notification={notif}
                data={data} />
        );
    }

    if (currentDateItems.length) {
        items.push(<DateNotifications items={currentDateItems} />);
    }

    return (
        <ul class={'np-notifications-list' + (STRINGS._d ? ' is-d' : '')}>
            {items}
            <NotifsLoadGap loading={loading} error={error} onLoad={loadMoreNotifications} />
        </ul>
    );
}

function DateNotifications ({ items }) {
    return (
        <ul class="np-date-notifications" role="list">
            {items}
        </ul>
    );
}

function DateHeader ({ date }) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    const label = new Intl.DateTimeFormat(STRINGS.intlLocale, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    }).format(date);

    const pad2 = x => ('00' + x).substr(-2);

    return (
        <h2 class="np-date-header">
            <time class="np-date-label font-league" datetime={`${year}-${pad2(month + 1)}-${pad2(day)}`}>
                {label}
            </time>
        </h2>
    );
}

function NotifsLoadGap({ loading, error, onLoad }) {
    return (
        <li class="np-notifs-load-gap">
            {loading ? (
                <NotifsLoading />
            ) : error ? (
                <>
                    <details class="np-error">
                        <summary>{STRINGS.loadError}</summary>
                        <pre>
                            {error.stack ? (error.message + '\n' + error.stack) : error.toString()}
                        </pre>
                    </details>
                    <button class="np-load-button" onClick={onLoad}>{STRINGS.loadTryAgain}</button>
                </>
            ) : (
                <button class="np-load-button" onClick={onLoad}>{STRINGS.loadMore}</button>
            )}
        </li>
    );
}

function NotifsLoading() {
    return (
        <div class="np-loading">
            <div class="np-inner-eggbug">
                {ICONS.eggbug}
            </div>
        </div>
    );
}

function ActionLabel({ parts, links }) {
    const nodes = [];
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 1) {
            const link = links[Math.floor(i / 2)];
            nodes.push(<a class="np-label-link" key={i} href={link}>{parts[i]}</a>);
        } else {
            nodes.push(<span key={i}>{parts[i]}</span>);
        }
    }
    return <>{nodes}</>;
}

function ProjectHandleLink({ handle }) {
    if (STRINGS._d) handle = 'eggbug';
    return <a class="np-project-handle" href={`/${handle}`}>@{handle}</a>;
}

function plaintextifyHtml(html) {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body>' + html + '</body></html>', 'text/html');
    return doc.body.textContent;
}

function postPreviewStr(post) {
    if (STRINGS._d) return 'eggbug eggbug';
    if (!post) return STRINGS.itemNotAvailable;
    if (post.headline) return post.headline;

    let out = '';
    for (const block of post.blocks) {
        if (block.type === 'attachment') {
            out += `[${block.attachment.altText || block.attachment.fileURL}] `;
        }
    }

    // TODO: better preview...
    out += plaintextifyHtml(post.plainTextBody);
    return out;
}

function TargetPost({ post }) {
    let attachment;

    if (post) {
        for (const block of post.blocks) {
            if (block.type === 'attachment') {
                const { attachment: item } = block;
                if (item.kind === 'audio') {
                    attachment = (
                        <div class="np-target-attachment is-audio">
                            {ICONS.audio}
                        </div>
                    );
                } else {
                    attachment = (
                        <img
                            class="np-target-attachment"
                            src={item.previewURL}
                            alt={item.altText || ''} />
                    );
                }
                break;
            }
        }
    }

    return (
        <>
            <a href={post?.singlePostPageUrl} class="np-notif-target">
                {postPreviewStr(post)}
            </a>
            {attachment}
        </>
    );
}

function TargetComment({ comment }) {
    return (
        <span class="np-notif-target">
            {comment?.comment?.body}
        </span>
    );
}

function targetPostLabel(post) {
    const s = postPreviewStr(post);
    if (s.length > 100) return '“' + s.slice(0, 100) + '…”';
    return '“' + s + '”';
}
function targetCommentLabel(comment) {
    return '“' + (comment?.comment?.body || '<empty>') + '”';
}

function GroupedNotifProjects({ projects, data, expanded: isExpanded, setExpanded }) {
    const [renderExpanded, setRenderExpanded] = useState(false);
    const [expandedHeight, setExpandedHeight] = useState(projects.length * 44); // initial guess

    const collapsedItems = [];
    const expandedItems = [];
    for (const projectId of projects) {
        const project = data.projects[projectId];
        if (!project) continue;

        const icon = (
            <img
                class={`np-project-icon mask mask-${project.avatarShape}`}
                src={project.avatarPreviewURL}
                alt={project.handle} />
        );

        collapsedItems.push(
            <li class="np-collapsed-item" role="listitem">
                <a class="np-inner-item" href={`/${project.handle}`} title={`@${project.handle}`}>
                    {icon}
                </a>
            </li>
        );

        expandedItems.push(
            <li class="np-expanded-item" role="listitem">
                {icon}
                <ProjectHandleLink handle={project.handle} />
            </li>
        );
    }

    useEffect(() => {
        if (isExpanded) setRenderExpanded(true);
    }, [isExpanded]);

    const expandedContents = useRef(null);
    const expansion = useSpring({ dampingRatio: 0.8, value: isExpanded ? 1 : 0 });
    expansion.setTarget(isExpanded ? 1 : 0);

    const expandedContainer = useRef(null);
    const expandButton = useRef(null);
    const animParams = useRef(null);
    animParams.current = [expandedHeight, isExpanded];
    const anim = useAnimation([expandedContainer, expandButton], { expansion }, ({ expansion }) => {
        const [expandedHeight] = animParams.current;

        return [
            { height: (Math.max(0, expansion) * expandedHeight) + 'px' },
            { transform: `rotate(${expansion / 2}turn)` },
        ];
    });

    useLayoutEffect(() => {
        if (expandedContents.current) {
            setExpandedHeight(expandedContents.current.offsetHeight);
            anim.resolve();
        }
    });

    useEffect(() => {
        const onFinish = () => {
            const [, isExpanded] = animParams.current;
            if (!isExpanded) setRenderExpanded(false);
        };
        anim.on('finish', onFinish);
        return () => anim.removeListener('finish', onFinish);
    }, [anim]);

    const [expandedContainerStyle, expandButtonStyle] = anim.getCurrentStyles();

    return (
        <div class="np-grouped-notif-projects" role="group">
            <div class="np-collapsed-container">
                <button
                    ref={expandButton}
                    class="np-expand-button"
                    style={expandButtonStyle}
                    aria-label={isExpanded ? STRINGS.groupedCollapse : STRINGS.groupedExpand}
                    onClick={() => setExpanded(!isExpanded)}>
                    {ICONS.expand}
                </button>
                <ul class="np-inner-items" role="list" aria-hidden={isExpanded ? 'true' : 'false'}>
                    {collapsedItems}
                </ul>
                <div class="np-shroud" />
            </div>
            <div class="np-expanded-container" ref={expandedContainer} style={expandedContainerStyle}>
                {renderExpanded ? (
                    <div class="np-expanded-contents" ref={expandedContents}>
                        <div class="np-inner-top-padding" />
                        <ul class="np-inner-items">
                            {expandedItems}
                        </ul>
                    </div>
                ) : null}
            </div>
        </div>
    );
}

function NotifContent({ body, linkTarget }) {
    if (STRINGS._d) body = 'eggbug eggbug';

    return (
        <blockquote class="np-notif-content">
            {linkTarget ? (
                <a href={linkTarget}>
                    {body}
                </a>
            ) : (
                body
            )}
        </blockquote>
    );
}

function CommentContent({ comment, linkTarget }) {
    return <NotifContent body={comment?.comment?.body} linkTarget={linkTarget} />;
}

function PostContent({ post }) {
    return <NotifContent body={postPreviewStr(post)} linkTarget={post?.singlePostPageUrl} />;
}

function PostTagsContent({ post, linkTarget }) {
    return <NotifContent body={post?.tags?.map(tag => '#' + tag)?.join(' ')} linkTarget={post?.singlePostPageUrl} />;
}

function Notification({ login, notification, data, isLast, highlightRef }) {
    const [expanded, setExpanded] = useState(false);

    let contents;
    let contentLabel;
    {
        if (notification.type === 'like') {
            const toPost = data.posts[notification.toPostId];
            const fromProject = data.projects[notification.fromProjectId];
            const isOwnPost = login.projectId === toPost?.postingProject?.projectId;

            const actionLabel = isOwnPost ? STRINGS.actions.like : STRINGS.actions.likeShare;
            contentLabel = [
                fromProject?.handle,
                actionLabel.join(''),
                targetPostLabel(toPost),
            ].join(' ');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.like}</div>
                        <div class="np-project-icon-container" aria-hidden="true">
                            <img class={`np-project-icon mask mask-${fromProject?.avatarShape}`} src={fromProject?.avatarPreviewURL} />
                        </div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ProjectHandleLink handle={fromProject?.handle} />
                                <ActionLabel parts={actionLabel} links={[toPost?.singlePostPageUrl]} />
                            </div>
                            <TargetPost post={toPost} />
                        </div>
                    </h3>
                </div>
            );
        } else if (notification.type === 'groupedLike') {
            const toPost = data.posts[notification.toPostId];
            const isOwnPost = login.projectId === toPost?.postingProject?.projectId;

            const actionLabel = isOwnPost
                ? STRINGS.actions.groupedLike
                : STRINGS.actions.groupedLikeShare;

            contentLabel = [
                actionLabel.join(''),
                targetPostLabel(toPost),
            ].join(' ');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.like}</div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ActionLabel parts={actionLabel} links={[toPost?.singlePostPageUrl]} />
                            </div>
                            <TargetPost post={toPost} />
                        </div>
                    </h3>
                    <GroupedNotifProjects projects={notification.fromProjectIds} data={data} expanded={expanded} setExpanded={setExpanded} />
                </div>
            );
        } else if (notification.type === 'share') {
            const toPost = data.posts[notification.toPostId];
            const sharePost = data.posts[notification.sharePostId];
            const fromProject = data.projects[notification.fromProjectId];
            const isOwnPost = login.projectId === toPost?.postingProject?.projectId;

            let label, hasContent;
            if (isOwnPost) {
                if (notification.transparentShare) {
                    label = STRINGS.actions.share;
                } else {
                    label = STRINGS.actions.shareAdd;
                }
            } else if (notification.transparentShare) {
                label = STRINGS.actions.shareShare;
            } else {
                label = STRINGS.actions.shareShareAdd;
            }

            contentLabel = [
                fromProject?.handle,
                label.join(''),
                targetPostLabel(toPost),
            ].join(' ');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.share}</div>
                        <div class="np-project-icon-container" aria-hidden="true">
                            <img class={`np-project-icon mask mask-${fromProject?.avatarShape}`} src={fromProject?.avatarPreviewURL} />
                        </div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ProjectHandleLink handle={fromProject?.handle} />
                                <ActionLabel parts={label} links={[sharePost?.singlePostPageUrl]} />
                            </div>
                            <TargetPost post={toPost} />
                        </div>
                    </h3>
                    {notification.transparentShare ? (
                        <PostTagsContent post={sharePost} />
                    ) : (
                        <PostContent post={sharePost} />
                    )}
                </div>
            );
        } else if (notification.type === 'groupedShare') {
            const toPost = data.posts[notification.toPostId];
            const isOwnPost = login.projectId === toPost?.postingProject?.projectId;

            contentLabel = [
                STRINGS.actions.groupedShare.join(''),
                targetPostLabel(toPost),
            ].join(' ');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.share}</div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ActionLabel parts={isOwnPost ? STRINGS.actions.groupedShare : STRINGS.actions.groupedShareShare} links={[toPost?.singlePostPageUrl]} />
                            </div>
                            <TargetPost post={toPost} />
                        </div>
                    </h3>
                    <GroupedNotifProjects projects={notification.fromProjectIds} data={data} expanded={expanded} setExpanded={setExpanded} />
                </div>
            );
        } else if (notification.type === 'comment') {
            const toPost = data.posts[notification.toPostId];
            const fromProject = data.projects[notification.fromProjectId];
            const comment = data.comments[notification.commentId];
            const replyToComment = data.comments[notification.inReplyTo];

            const isOwnPost = login.projectId === toPost?.postingProject?.projectId;
            const isOwnReplyToComment = login.projectId === replyToComment?.poster?.projectId;

            const linkTarget = toPost?.singlePostPageUrl + '#comment-' + notification.commentId;

            const actionLabelParts = (notification.inReplyTo && isOwnReplyToComment)
                ? STRINGS.actions.commentReply
                : isOwnPost
                ? STRINGS.actions.comment
                : STRINGS.actions.commentShare;

            contentLabel = [
                fromProject?.handle,
                actionLabelParts.join(''),
                notification.inReplyTo && isOwnReplyToComment
                    ? targetCommentLabel(replyToComment)
                    : targetPostLabel(toPost),
            ].join(' ');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.comment}</div>
                        <div class="np-project-icon-container" aria-hidden="true">
                            <img class={`np-project-icon mask mask-${fromProject?.avatarShape}`} src={fromProject?.avatarPreviewURL} />
                        </div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ProjectHandleLink handle={fromProject?.handle} />
                                <ActionLabel
                                    parts={actionLabelParts}
                                    links={[linkTarget]} />
                            </div>
                            {(notification.inReplyTo && isOwnReplyToComment) ? (
                                <TargetComment comment={replyToComment} />
                            ) : (
                                <TargetPost post={toPost} />
                            )}
                        </div>
                    </h3>
                    <CommentContent comment={comment} linkTarget={linkTarget} />
                </div>
            );
        } else if (notification.type === 'follow') {
            const fromProject = data.projects[notification.fromProjectId];

            contentLabel = [
                fromProject?.handle,
                STRINGS.actions.follow.join(''),
            ].join(' ');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.follow}</div>
                        <div class="np-project-icon-container" aria-hidden="true">
                            <img class={`np-project-icon mask mask-${fromProject?.avatarShape}`} src={fromProject?.avatarPreviewURL} />
                        </div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ProjectHandleLink handle={fromProject?.handle} />
                                <ActionLabel parts={STRINGS.actions.follow} links={[]} />
                            </div>
                        </div>
                    </h3>
                </div>
            );
        } else if (notification.type === 'groupedFollow') {
            contentLabel = STRINGS.actions.groupedFollow.join('');

            contents = (
                <div class="np-inner-notif">
                    <h3 class="np-content-line">
                        <div class="np-icon">{ICONS.groupedFollow}</div>
                        <div class="np-inner-content">
                            <div class="np-label">
                                <ActionLabel parts={STRINGS.actions.groupedFollow} links={[]} />
                            </div>
                        </div>
                    </h3>
                    <GroupedNotifProjects projects={notification.fromProjectIds} data={data} expanded={expanded} setExpanded={setExpanded} />
                </div>
            );
        } else {
            contents = `(unknown type ${notification.type})`;
        }
    }

    const notifNode = useRef(null);
    const [impostorHeight, setImpostorHeight] = useState(0);

    const iobData = useRef(null);
    iobData.current = [impostorHeight, setImpostorHeight];
    const iobHideTimeout = useRef(null);
    const iobs = new IntersectionObserver((entries) => {
        const [impostorHeight, setImpostorHeight] = iobData.current;

        if (entries[0].isIntersecting) {
            // visible; show actual node
            clearTimeout(iobHideTimeout.current);
            setImpostorHeight(0);
        } else if (!impostorHeight) {
            // out of frame
            clearTimeout(iobHideTimeout.current);
            iobHideTimeout.current = setTimeout(() => {
                setImpostorHeight(notifNode.current.offsetHeight);
            }, 100);
        }
    }, {
        threshold: 0,
    });
    useEffect(() => {
        const node = notifNode.current;
        if (!node) return;
        iobs.observe(node);

        if (highlightRef) highlightRef.current = node;

        return () => iobs.unobserve(node);
    }, [notifNode.current]);

    return (
        <li
            class={'np-notification' + (isLast ? ' np-is-last': '')}
            tabindex={0}
            ref={notifNode}
            role="listitem"
            aria-label={contentLabel}>
            {impostorHeight ? (
                <div class="np-off-screen-impostor" style={{ height: impostorHeight + 'px' }} />
            ) : contents}
        </li>
    );
}
