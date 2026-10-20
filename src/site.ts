/** Shared site details. Set SITE_URL in the build environment when using a custom domain. */
export const site = {
  name: 'Josh Griffey',
  author: 'Josh Griffey',
  description: 'Product and interaction design, prototyping and AI-assisted development by Josh Griffey.',
  email: 'joshgriffey@gmail.com',
  instagram: 'https://www.instagram.com/jg.kidd/',
  linkedin: 'https://www.linkedin.com/in/joshgriffey/',
};
export interface Page {
  id: number;
  path: string;
  title: string;
  description: string;
  bodyClass: string;
  content: string;
  styles: string[];
  standalone: boolean;
  type: string;
  date: string;
  image: string;
}
export function emailDraft(name: string, email: string, message: string): string {
  const subject = name.trim() ? `Portfolio enquiry from ${name.trim()}` : 'Portfolio enquiry';
  return `mailto:${site.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${message.trim()}\n\n${name.trim()}\n${email.trim()}`)}`;
}
export function matchesCategory(classes: Iterable<string>, category: string): boolean {
  return category === '__all' || [...classes].includes(`elementor-filter-${category}`);
}
