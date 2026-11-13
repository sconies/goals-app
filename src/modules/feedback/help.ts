/* Feedback's Help articles (SW1): sending feedback and marking up a screen, and the inbox. They were the core
   guide's; with Feedback behind its switch they are the module's, so Help hides them while Feedback is off and their
   addresses say Feedback is switched off. src/help/guide.ts places them after AI assistants, where they always were. */
import type { Article } from '../../help/guide';

const help: Article[] = [
  {
    id: 'feedback',
    title: 'Send feedback, and marking up a screen',
    summary: 'Tell the people building Faro what should change: mark up the screen you’re on, or say in a few words how the app is working for you.',
    group: 'you',
    after: 'ai-assistants',
    sections: [
      { heading: 'How to use it', list: [
        'Go to Feedback (in the menu’s last group, or in More on a phone) and choose Send feedback. Its first choice is Mark up the last screen: it takes you back to the page you came from and keeps a picture of it. On a computer, Ctrl+Shift+M (Cmd+Shift+M on a Mac) marks up the screen you’re on from anywhere.',
        'The screen you’re on is kept as a still picture, and a slim toolbar appears. Draw on the picture with the Pen, an Arrow or a Box, or put down a numbered Note with a few words. Undo takes back the last mark, Clear removes them all, and Cancel (or Escape) stops without sending anything.',
        'Next asks one thing: what should change. You can also say how the app is working for you. It shows the exact picture that will be sent, with your marks. Go Back to change it, or Cancel.',
        'Send. “Sent. You’ll hear when it’s fixed.” When a release fixes it, its entry in What’s new says “You raised this”.',
        'Or skip the picture: choose how it’s working and add a few words, as before. It goes to the same inbox as markups, where the people building Faro mark it in hand, fixed or won’t fix. When a release fixes it, its entry in What’s new says “You raised this” too.',
      ] },
      { heading: 'With the keyboard', list: [
        'Tab to the drawing area. The arrow keys move a crosshair (with Shift, further), Enter starts and ends a mark, and P, A, B and N choose Pen, Arrow, Box and Note.',
        'Ctrl+Z takes back the last mark. Escape stops the mark you’re making, or else cancels.',
      ] },
      { heading: 'What’s sent', list: [
        'The picture of your screen, as it was. Nothing on it is hidden, so check it before you send.',
        'Your marks, your line, your name, which parts of the screen your marks are on (for example Goal page, Scorecard, Will it hit), the page, your screen size, light or dark, your accent and the app’s version.',
        'Your last 20 steps on this visit, unless you untick them: the pages you opened and the buttons you pressed, never what you typed. And any errors or saves that didn’t go through on this visit.',
        'In the demo, markups are sent too, marked as from the demo. Anyone can read them in the inbox on Workspace, picture included: Faro holds no real data, so nothing on your screen should be private.',
      ] },
    ],
    routes: [],
    screens: [],
    reqs: ['MARKUP', 'FEEDBACK-RAISED'],
    keywords: ['feedback', 'markup', 'mark up', 'picture', 'draw', 'shortcut', 'ctrl shift m', 'report a problem', 'what should change', 'you raised this'],
    related: ['inbox', 'recording', 'help'],
  },
  {
    id: 'inbox',
    title: 'The inbox',
    summary: 'Every markup and piece of feedback people send, from every workspace and the demo, on its own page, Feedback, beside Help. Open to anyone with no sign-in: work through it like an inbox, from New to In hand to Closed.',
    group: 'you',
    after: 'feedback',
    sections: [
      { heading: 'Who can read it', list: [
        'The inbox is its own page, Feedback, beside Help in the sidebar (in More on a phone), in the app and the demo. It was a section of Workspace; it moved because it belongs to no one workspace. Old links to Workspace’s inbox open it.',
        'It holds what’s sent from every workspace and the demo, and says where each came from. There’s no sign-in: anyone can read it and send feedback, on any device. Only an admin changes a status (In hand, Fixed, Won’t fix, New again); everyone else sees a line saying so, and no buttons. Every change says who made it and can be undone. Faro holds no real data, so there is nothing to keep back. The company’s own app keeps its inbox to the people who look after the app.',
        'It names people, never their email. The New tab says how many are new; The New tab counts them across every workspace.',
        'Send feedback, at the top, opens the feedback sheet; it says which page you came from, and Mark up the last screen goes back to it.',
      ] },
      { heading: 'Working through it', list: [
        'Three tabs: New, In hand and Closed (fixed or won’t fix), each with how many it holds. When New is empty, it says Nothing new.',
        'Each row starts with its status as a shape and a word, then what was said, the part of the page it’s about (or, for feedback, its mood and page), who sent it, from where and when.',
        'Markups about the same part of the same page are folded into one row that says how many (“6 on this part”). Open it to see each one; whatever you do to the row happens to all of them.',
        'Find things with the search (what was said, the part, the page or who sent it). Kind (markups or feedback) sits beside it on a computer; Filters holds the page and who sent it (type a name to find them), and on a phone the kind too. The line under the search counts what matches and says the filters in words, each with Remove; the address keeps the search and the filters, so Back and a shared link show the same list.',
        'On a computer the list and the open item sit side by side. Keys: J and K move down and up the list, I marks the open item in hand, F opens Mark fixed, W opens Won’t fix.',
        'On a phone you see one item at a time: Next goes on to the next, and Back to the list returns.',
        'Once you handle an item and it leaves the tab, the next one opens. Undo, at the top, puts back what you just changed.',
        'Tick rows (or Select this page) to change a batch at once: Mark in hand, Mark fixed in a What’s new entry, Won’t fix with one reason, or Mark new again. A page shows 25 rows.',
      ] },
      { heading: 'A markup', list: [
        'Open one to see its picture (hide the drawing to see the screen beneath), the parts its marks are on, its notes, the steps before it as a timeline, any errors, and where it was sent from.',
        'Mark it in hand. Open GitHub issue opens a new issue on GitHub filled in with the line, the page, the parts, the steps and a link back here: press Submit there, then paste the issue’s address back with Paste issue link.',
        'Mark it fixed in a What’s new entry, so its sender sees “You raised this” there; or say why it won’t be fixed.',
        'Each change says who made it (you, as you chose on this device) and when.',
      ] },
      { heading: 'Connect Claude', list: [
        'Connect Claude opens from the top of the inbox. Any Faro token works. An admin makes one there (in the app, not the demo); anyone else asks an admin. Then copy the set-up: for a Claude cloud session, the host and where the token goes; for Claude Code, one command.',
        'Claude then reviews the inbox in one step, with review_inbox: new markups grouped by the part of the screen they’re about, each with its picture, and new feedback by page. It sees the pictures without opening anything. Its changes say they were made by the token’s person, via the AI assistant.',
        'Connect Claude says whether the server can send Claude the pictures, and if not, why.',
        'Tokens are listed, and revoked, on Workspace under Access, and yours in Settings.',
      ] },
      { heading: 'Feedback', list: [
        'Feedback sent with a mood and a few words is in the inbox too, among the markups, newest first, with a speech mark where a markup has its picture. Each says it’s feedback, its mood, the page it was sent from, who sent it and from which workspace.',
        'It has the same statuses and is worked the same way. It has no picture and no GitHub issue. It always arrives as New.',
      ] },
      { heading: 'Without a database', text: ['When Faro runs with no database (on a laptop, say), markups stay in that browser, and the inbox shows them, and this workspace’s feedback. Statuses you give feedback there stay in that browser.'] },
    ],
    routes: ['/feedback', '/workspace/inbox', '/inbox'],
    screens: ['Feedback'],
    reqs: ['MARKUP-INBOX', 'FEEDBACK-INBOX', 'MCP-FEEDBACK', 'CONNECT-CLAUDE', 'MCP-PICTURES', 'INBOX-TRIAGE', 'FEEDBACK-PAGE'],
    keywords: ['inbox', 'markups', 'triage', 'github issue', 'undo', 'who changed it', 'fixed', 'won’t fix', 'in hand', 'feedback', 'mood', 'connect claude', 'token', 'review inbox', 'pictures'],
    related: ['feedback', 'workspace', 'ai-assistants'],
  },
];

export default help;
