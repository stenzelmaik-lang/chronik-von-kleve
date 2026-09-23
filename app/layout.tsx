import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Chronik von Kleve · Die Domäne', description: 'Eine interaktive Vampire: The Masquerade Chronik mit Weltkarte, Charakteren, Geheimnissen und Spielleiter-CMS.', icons: {icon:'/favicon.svg',shortcut:'/favicon.svg'}, openGraph: {title:'Chronik von Kleve · Die Domäne',description:'Eine interaktive Chronik aus Blut, Schuld und Ordnung.',images:['/og.png'],type:'website'}, twitter:{card:'summary_large_image',title:'Chronik von Kleve · Die Domäne',description:'Eine interaktive Chronik aus Blut, Schuld und Ordnung.',images:['/og.png']} };
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="de"><body>{children}</body></html>}
