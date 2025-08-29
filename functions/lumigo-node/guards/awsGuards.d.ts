import { LambdaContext } from '../types/aws/awsEnvironment';
export declare function isAwsContext(awsContext: LambdaContext | any): awsContext is LambdaContext;
