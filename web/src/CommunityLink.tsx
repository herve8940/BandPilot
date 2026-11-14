import {MessageCircle} from 'lucide-react';
import community from '../../config/community.json';
import {tx,useLanguage} from './i18n';
import {isAndroid} from './platform';
import './community.css';

export type CommunityDestination = 'invite' | keyof typeof community.channels;
const labels = {
 invite: 'Rejoindre la communauté Discord',
 help: 'Demander de l’aide sur Discord',
 bugs: 'Ouvrir #bugs-tests',
 guide: 'Guide de démarrage sur Discord',
 ideas: 'Proposer une idée sur Discord',
} as const;

export function CommunityLink({destination='invite'}:{destination?:CommunityDestination}){
 useLanguage();
 const href=destination==='invite'?community.inviteUrl:`https://discord.com/channels/${community.serverId}/${community.channels[destination].id}`;
 const label=tx(labels[destination]);
 return <a className="community-link" href={href} target={isAndroid?'_self':'_blank'} rel="noopener noreferrer" aria-label={label} title={label}><MessageCircle size={17} aria-hidden="true"/><span>{destination==='invite'?tx('Communauté Discord'):label}</span></a>;
}
