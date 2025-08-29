export interface FunctionSpan {
    info: any;
    id: string;
    envs: string;
    name: string;
    type: string;
    ended: number;
    event: string;
    started: number;
    maxFinishTime: number;
}
