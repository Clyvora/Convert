import Mascot from './Mascot'
import { Icon } from './Icon'

export default function AboutPage() {
  return <div className="about-story">
    <section className="about-lead"><div><p className="eyebrow">A LITTLE TOOL WITH A LITTLE ATTITUDE</p><h2>For the things<br/>you want to keep.</h2><p>That clip. That sound. That file in the wrong format. Give it a link or a file, and make it yours to use.</p></div><div className="about-mascot"><span className="mascot-orbit" aria-hidden="true"/><Mascot pose="ready"/><span className="about-sticker">hi, human. <span aria-hidden="true">↗</span></span></div></section>
    <div className="about-principles"><article><span className="principle-number">01 / ON YOUR DEVICE</span><h3>Your files, your device</h3><p>Local audio and video conversion runs in your browser. Your files stay with you. After a refresh, choose them again.</p><Icon name="convert"/></article><article><span className="principle-number">02 / A LINK AWAY</span><h3>Save what matters.</h3><p>Public links use Clyvora’s media service and contact the source platform. Downloads depend on what that source makes available.</p><Icon name="link"/></article></div>
    <section className="about-small-print"><h3>Good tools. Clear boundaries.</h3><div><p>Remote files expire after 24 hours. Job and session metadata expire after seven days.</p><p>Use media you have permission to download. Convert does not bypass DRM, paywalls, private accounts, or authentication.</p></div></section>
    <footer className="about-signoff"><div><img src="/brand-cat-transparent.svg" width="40" height="40" alt=""/><span>Made with care.<br/><strong>Part of Clyvora.</strong></span></div><a href="https://www.clyvora.tech/" target="_blank" rel="noreferrer">Meet the rest of Clyvora <Icon name="arrow"/></a></footer>
  </div>
}
