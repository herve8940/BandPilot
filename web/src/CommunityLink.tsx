import {MessageCircle} from 'lucide-react';
import community from '../../config/community.json';
import {tx,useLanguage} from './i18n';
import {isAndroid} from './platform';
import './community.css';

export function CommunityLink(){
 useLanguage();
 return <a className="community-link" href={community.inviteUrl} target={isAndroid?'_self':'_blank'} rel="noopener noreferrer" aria-label={tx('Rejoindre la communauté Discord')} title={tx('Rejoindre la communauté Discord')}><MessageCircle size={17} aria-hidden="true"/><span>{tx('Communauté Discord')}</span></a>;
}
