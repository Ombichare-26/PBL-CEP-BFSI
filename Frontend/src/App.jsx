import {BrowserRouter,Routes,Route} from "react-router-dom"
import Navbar from "./components/Navbar.jsx"
import Footer from "./components/Footer.jsx"

import Home from "./pages/Home"
import Input from "./pages/InputPage.jsx"
// import UploadPortfolio from "./pages/UploadPortfolio.jsx"
// import PortfolioView from "./pages/PortfolioView.jsx"
// import Allocation from "./pages/Allocation.jsx"
// import Result from "./pages/Result";


function App()
{
  return(
    <BrowserRouter>
    <Navbar/>
    <Routes>
      <Route path="/" element ={<Home/>}/>
      <Route path="/input" element={<Input/>}/>
      {/* <Route path="/upload" element={<UploadPortfolio/>}/>
      <Route path="/portfolio" element={<PortfolioView/>}/>
      <Route path="/allocate" element={<Allocation/>}/>
      <Route path="/result" element={<Result/>}/> */}
    </Routes>
    <Footer />
    </BrowserRouter>
  );
}

export default App;