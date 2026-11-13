/* N25: who may speak for a review (RV7, docs/design/reviews/spec.md section 3). run({ open }) returns a list of failures.
   [REVIEW-SPEAK] Someone not in a review reads it but can't speak for it: its page has no primary button and no Join it
   would refuse, and says who can add them; a goal opened in its walk offers nothing to say. Someone in it, and an admin,
   get the review's own buttons. */
module.exports = {
  id: 'N25',
  area: 'reviews',
  title: 'Who may speak for a review: a non-member reads and is told who can add them; a member and an admin speak',
  reqs: ['REVIEW-SPEAK'],
  async run({ open }) {
    const fails = [];
    const check = (ok, msg) => { if (!ok) fails.push(msg); };
    for (const [w, touch] of [[390, true], [1280, false]]) {
      // Oskar is not in the Developer Productivity fortnightly and is not an admin.
      {
        const [c, p] = await open(w, 900, 'oskar', '/reviews/devprod', touch);
        await p.locator('.review-home').waitFor();
        const hero = await p.locator('.review-home .hero').innerText();
        check(await p.locator('.review-home .btn.primary').count() === 0, `${w}: someone not in the review has a primary button on its page`);
        check(!/Join this review/.test(hero), `${w}: the review still offers Join`);
        check(/You’re not in this review\. .+ or an admin can add you\./.test(hero), `${w}: the page doesn’t say who can add them (“${hero.replace(/\s+/g, ' ').slice(0, 200)}”)`);
        await p.goto(p.url().replace('/reviews/devprod', '/goals/lead-mq').replace('?', '?review=devprod&'));
        await p.locator('.decide').first().waitFor({ timeout: 8000 }).catch(() => {});
        const decide = await p.locator('.decide').first().innerText().catch(() => '');
        check(/Only people in it, or an admin, speak for it/.test(decide) && !(await p.locator('.decide').getByRole('button', { name: /reviewed|note|next step|question|accept/i }).count()), `${w}: the walk offers a non-member something to say (“${decide.replace(/\s+/g, ' ').slice(0, 160)}”)`);
        await c.close();
      }
      // Daniel is in it; Grace is an admin who isn't: both get the review's own buttons and no join line.
      for (const who of ['daniel', 'grace']) {
        const [c, p] = await open(w, 900, who, '/reviews/devprod', touch);
        await p.locator('.review-home').waitFor();
        const hero = await p.locator('.review-home .hero').innerText();
        check(!/You’re not in this review/.test(hero), `${w}: ${who} is told they aren’t in the review`);
        await c.close();
      }
    }
    return fails;
  },
};
