import {Component,type ErrorInfo,type ReactNode} from 'react';
import {SupportCenter} from './SupportCenter';
import {reportUIError} from './diagnostics';
import {tx} from './i18n';
export class AppErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error,info:ErrorInfo){reportUIError('react.render',new Error(error.message+'\n'+info.componentStack));}
 render(){return this.state.failed?<main style={{padding:32,maxWidth:720,margin:'auto'}}><h1>BandPilot</h1><p role="alert">{tx('L’interface a rencontré un problème. Tu peux enregistrer un rapport avant de la recharger.')}</p><SupportCenter/><button type="button" onClick={()=>window.location.reload()}>{tx('Recharger l’interface')}</button></main>:this.props.children;}
}
