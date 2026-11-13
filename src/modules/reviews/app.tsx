/* Reviews on screen (FT2): its seven addresses. The screens themselves are still the core's (src/screens/Review.tsx and
   Print.tsx's ReviewPrint) until FT3 moves them here; they load when first opened, as App.tsx loaded them. Its menu row
   stays the core's (domain/navigation menuGroups, which takes whether Reviews is on), and so does the walk on a goal's
   page (?review=). With Reviews switched off none of these routes is there, and the not-found page says it is off. Each
   route keeps no title of its own, so a page's name is still the navigation rule's ("Change {review}", "{review},
   to print"), and the set-up and edit pages are still forms (navigation FORM). Its facts are in module.json. */
import { lazy } from 'react';
import type { AppModule } from '../../core/app';

const ReviewEdit = lazy(() => import('../../screens/Review').then((m) => ({ default: m.ReviewEdit })));
const ReviewHome = lazy(() => import('../../screens/Review').then((m) => ({ default: m.ReviewHome })));
const ReviewRedirect = lazy(() => import('../../screens/Review').then((m) => ({ default: m.ReviewRedirect })));
const Reviews = lazy(() => import('../../screens/Review').then((m) => ({ default: m.Reviews })));
const ReviewSummary = lazy(() => import('../../screens/Review').then((m) => ({ default: m.ReviewSummary })));
const ReviewPrint = lazy(() => import('../../screens/Print').then((m) => ({ default: m.ReviewPrint })));

const reviews: AppModule = {
  routes: [
    { path: '/review', element: <ReviewRedirect /> },
    { path: '/reviews', element: <Reviews /> },
    { path: '/reviews/new', element: <ReviewEdit /> },
    { path: '/reviews/:reviewId', element: <ReviewHome /> },
    { path: '/reviews/:reviewId/edit', element: <ReviewEdit /> },
    { path: '/reviews/:reviewId/summary', element: <ReviewSummary /> },
    { path: '/reviews/:reviewId/print', element: <ReviewPrint /> },
  ],
};

export default reviews;
