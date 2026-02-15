declare module 'validate-npm-package-name' {
    interface Result {
        validForNewPackages: boolean;
        validForOldPackages: boolean;
        errors?: string[];
        warnings?: string[];
    }
    
    function validate(name: string): Result;
    export = validate;
}
