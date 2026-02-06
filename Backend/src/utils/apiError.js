class ApiErrors extends Error{
 constructor(
    statusCode, message = "Something went wrong",
    errors = [],
    stack = ""
 ){
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.success = false;
    this.data = null;
    this.errors = errors

    if(stack){
        this.stack = stack;
    }

    else{
        Error.captureStackTrace(this, this.constructor);
    }
 }
}

export {ApiErrors}